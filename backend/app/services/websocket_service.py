"""
WebSocket connection manager with Redis Pub/Sub for multi-instance broadcasting.
"""
import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger("smartland.ws")


class ConnectionManager:
    """Manages WebSocket connections per user."""

    def __init__(self):
        self.active: dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)
        logger.info(f"WS connected: user={user_id}, total={self._count()}")

    async def disconnect(self, user_id: int, ws: WebSocket):
        connections = self.active.get(user_id, [])
        if ws in connections:
            connections.remove(ws)
        if not connections:
            self.active.pop(user_id, None)
        logger.info(f"WS disconnected: user={user_id}, total={self._count()}")

    async def broadcast(self, message: dict):
        """Send message to all connected users."""
        data = json.dumps(message, default=str)
        dead = []
        for user_id, connections in self.active.items():
            for ws in connections:
                try:
                    if ws.client_state == WebSocketState.CONNECTED:
                        await ws.send_text(data)
                except Exception:
                    dead.append((user_id, ws))

        for user_id, ws in dead:
            await self.disconnect(user_id, ws)

    async def send_to_user(self, user_id: int, message: dict):
        """Send message to a specific user's connections."""
        data = json.dumps(message, default=str)
        connections = self.active.get(user_id, [])
        dead = []
        for ws in connections:
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_text(data)
            except Exception:
                dead.append(ws)

        for ws in dead:
            await self.disconnect(user_id, ws)

    def _count(self) -> int:
        return sum(len(conns) for conns in self.active.values())


# Singleton
manager = ConnectionManager()


async def publish_event(event_type: str, data: Any = None, user_id: int | None = None):
    """
    Publish event to WebSocket clients.
    If user_id is None, broadcasts to all.
    Also publishes to Redis for multi-instance support.
    """
    message = {"type": event_type, "data": data}

    if user_id is not None:
        await manager.send_to_user(user_id, message)
    else:
        await manager.broadcast(message)

    # Also publish to Redis Pub/Sub for other backend instances
    try:
        from app.services.cache_service import _get_redis
        redis_client = _get_redis()
        channel = f"ws:user:{user_id}" if user_id else "ws:broadcast"
        redis_client.publish(channel, json.dumps(message, default=str))
    except Exception:
        pass  # Redis unavailable, local-only broadcast is fine
