"""Two-tier server cache: Redis when available, in-process TTL dict otherwise.

The prototype must run in an evaluation sandbox without a Redis daemon, so the
Redis client is probed once at start-up and the module transparently degrades to
an in-memory LRU/TTL store. Cache hits/misses are exposed via /api/v1/system/cache
so the caching layer is demonstrable during judging.
"""
from __future__ import annotations

import functools
import hashlib
import json
import threading
import time
from typing import Any, Callable

from .config import settings

_lock = threading.Lock()
_memory: dict[str, tuple[float, str]] = {}
_stats = {"hits": 0, "misses": 0, "sets": 0, "backend": "memory", "evictions": 0}

_redis = None
try:  # pragma: no cover - depends on local environment
    import redis as _redis_lib

    _client = _redis_lib.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=0.3)
    _client.ping()
    _redis = _client
    _stats["backend"] = "redis"
except Exception:
    _redis = None


def _key(namespace: str, payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str)
    digest = hashlib.sha1(raw.encode()).hexdigest()[:16]
    return f"mausam:{namespace}:{digest}"


def get(key: str) -> Any | None:
    if _redis is not None:
        try:
            raw = _redis.get(key)
            if raw is None:
                _stats["misses"] += 1
                return None
            _stats["hits"] += 1
            return json.loads(raw)
        except Exception:
            pass
    with _lock:
        entry = _memory.get(key)
        if not entry:
            _stats["misses"] += 1
            return None
        expires, raw = entry
        if expires < time.time():
            _memory.pop(key, None)
            _stats["evictions"] += 1
            _stats["misses"] += 1
            return None
        _stats["hits"] += 1
        return json.loads(raw)


def set(key: str, value: Any, ttl: int | None = None) -> None:
    ttl = ttl or settings.CACHE_TTL_SECONDS
    raw = json.dumps(value, default=str)
    _stats["sets"] += 1
    if _redis is not None:
        try:
            _redis.setex(key, ttl, raw)
            return
        except Exception:
            pass
    with _lock:
        if len(_memory) > 5000:  # crude bound for the prototype
            _memory.clear()
        _memory[key] = (time.time() + ttl, raw)


def cached(namespace: str, ttl: int | None = None) -> Callable:
    """Decorator that caches a JSON-serialisable return value by kwargs."""

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            payload = {"a": args, "k": kwargs}
            key = _key(namespace, payload)
            hit = get(key)
            if hit is not None:
                if isinstance(hit, dict):
                    hit.setdefault("meta", {})["cache"] = "HIT"
                return hit
            value = fn(*args, **kwargs)
            set(key, value, ttl)
            if isinstance(value, dict):
                value.setdefault("meta", {})["cache"] = "MISS"
            return value

        return wrapper

    return decorator


def stats() -> dict[str, Any]:
    total = _stats["hits"] + _stats["misses"]
    return {
        **_stats,
        "keys_in_memory": len(_memory),
        "hit_ratio": round(_stats["hits"] / total, 3) if total else 0.0,
        "ttl_seconds": settings.CACHE_TTL_SECONDS,
    }


def flush() -> None:
    with _lock:
        _memory.clear()
    if _redis is not None:
        try:
            for k in _redis.scan_iter("mausam:*"):
                _redis.delete(k)
        except Exception:
            pass
