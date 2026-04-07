import json
import logging
from typing import Any

import redis

from app.config import settings

logger = logging.getLogger("smartland.cache")

_redis_client: redis.Redis | None = None


def _get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            _redis_client.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.warning(f"Redis unavailable: {e}")
            _redis_client = None
            raise
    return _redis_client


class CacheService:
    """Redis cache wrapper with JSON serialization and graceful fallback."""

    def get(self, key: str) -> Any | None:
        try:
            client = _get_redis()
            data = client.get(key)
            if data is not None:
                return json.loads(data)
        except Exception:
            pass
        return None

    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        try:
            client = _get_redis()
            client.setex(key, ttl, json.dumps(value, default=str))
            return True
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        try:
            client = _get_redis()
            client.delete(key)
            return True
        except Exception:
            return False

    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern. Returns count deleted."""
        try:
            client = _get_redis()
            keys = list(client.scan_iter(match=pattern, count=100))
            if keys:
                return client.delete(*keys)
        except Exception:
            pass
        return 0

    def exists(self, key: str) -> bool:
        try:
            client = _get_redis()
            return client.exists(key) > 0
        except Exception:
            return False


cache = CacheService()
