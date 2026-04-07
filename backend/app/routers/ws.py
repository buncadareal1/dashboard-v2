"""
WebSocket endpoint for real-time dashboard updates.
Clients connect with their JWT token for authentication.
"""
import asyncio
import json
import logging

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.config import settings
from app.services.websocket_service import manager

logger = logging.getLogger("smartland.ws")

router = APIRouter(tags=["websocket"])


def _verify_ws_token(token: str) -> dict | None:
    """Verify JWT token for WebSocket connection."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.InvalidTokenError:
        return None


@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """
    WebSocket endpoint. Client connects with JWT token in URL.
    Receives real-time events: new_lead, lead_updated, lead_deleted,
    campaign_synced, kpi_updated, ai_complete.
    """
    # Authenticate
    payload = _verify_ws_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    username = payload.get("sub", "unknown")

    # Use a simple user_id hash since we don't query DB in WS
    user_id = hash(username) % 1_000_000

    await manager.connect(user_id, websocket)

    try:
        # Also listen to Redis Pub/Sub for events from other instances
        redis_task = asyncio.create_task(_listen_redis(user_id, websocket))

        # Keep connection alive, handle client pings
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                # Handle client messages (e.g., ping)
                if data == "ping":
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                # Send server ping to keep connection alive
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(json.dumps({"type": "ping"}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WS error for {username}: {e}")
    finally:
        redis_task.cancel()
        await manager.disconnect(user_id, websocket)


async def _listen_redis(user_id: int, websocket: WebSocket):
    """Listen to Redis Pub/Sub and forward messages to this WebSocket."""
    try:
        import redis.asyncio as aioredis
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"ws:user:{user_id}", "ws:broadcast")

        async for message in pubsub.listen():
            if message["type"] == "message" and websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(message["data"])

    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.debug(f"Redis Pub/Sub listener error: {e}")
