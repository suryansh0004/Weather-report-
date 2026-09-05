"""System, metadata and delta-sync endpoints (low-bandwidth edge support)."""
from __future__ import annotations

import gzip
import hashlib
import json
import time

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..core import cache
from ..core.config import settings
from ..data import loader
from ..services import bhashini
from .weather import homepage

router = APIRouter(prefix="/system", tags=["system"])
START = time.time()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "owner": settings.OWNER,
        "mode": "live" if settings.live_mode else "mock",
        "uptime_seconds": round(time.time() - START, 1),
        "cache_backend": cache.stats()["backend"],
        "personas": list(settings.PERSONAS),
        "languages": len(bhashini.languages()),
    }


@router.get("/cache")
def cache_stats():
    return cache.stats()


@router.post("/cache/flush")
def cache_flush():
    cache.flush()
    return {"flushed": True, **cache.stats()}


@router.get("/districts")
def districts():
    return {
        "count": len(loader.districts()),
        "districts": [
            {k: d[k] for k in ("id", "district", "state", "lat", "lon", "terrain", "agro_zone")}
            for d in loader.districts()
        ],
    }


class SyncRequest(BaseModel):
    lat: float
    lon: float
    persona: str = "commuter"
    lang: str = "hi"
    blocks: dict[str, str] = Field(default_factory=dict, description="block name -> etag held by the client")


BLOCKS = ("location", "observation", "air_quality", "hourly", "daily", "alerts", "layout", "persona_data", "voice", "uv")


def _etag(value) -> str:
    return hashlib.sha1(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()[:12]


@router.post("/sync", summary="Delta synchronisation for the offline-first client")
def delta_sync(req: SyncRequest):
    """Returns only the blocks whose etag differs from the client's copy.

    On a reconnect after an offline spell, a typical client holds most blocks
    unchanged (location, daily outlook, agromet bulletin) and only needs the
    observation, nowcast and alert blocks — which is where the bandwidth saving
    on a 2G link comes from.
    """
    full = homepage(lat=req.lat, lon=req.lon, persona=req.persona, lang=req.lang)
    changed, unchanged, etags = {}, [], {}
    for name in BLOCKS:
        value = full.get(name)
        tag = _etag(value)
        etags[name] = tag
        if req.blocks.get(name) == tag:
            unchanged.append(name)
        else:
            changed[name] = value

    full_raw = json.dumps(full, separators=(",", ":"), default=str).encode()
    delta_raw = json.dumps(changed, separators=(",", ":"), default=str).encode()
    return {
        "server_time": full["issued_at"],
        "etags": etags,
        "unchanged": unchanged,
        "changed_blocks": list(changed.keys()),
        "delta": changed,
        "transfer": {
            "full_uncompressed_bytes": len(full_raw),
            "full_gzip_bytes": len(gzip.compress(full_raw)),
            "delta_uncompressed_bytes": len(delta_raw),
            "delta_gzip_bytes": len(gzip.compress(delta_raw)),
            "saving_pct": round(100 * (1 - len(gzip.compress(delta_raw)) / max(1, len(gzip.compress(full_raw)))), 1),
        },
    }


@router.get("/payload-report", summary="Payload budget audit (target: < 50 KB gzipped)")
def payload_report(lat: float = 26.8467, lon: float = 80.9462, persona: str = "kisan", lang: str = "hi"):
    full = homepage(lat=lat, lon=lon, persona=persona, lang=lang)
    report = {}
    for name in BLOCKS:
        raw = json.dumps(full.get(name), separators=(",", ":"), default=str).encode()
        report[name] = {"bytes": len(raw), "gzip_bytes": len(gzip.compress(raw))}
    total_raw = json.dumps(full, separators=(",", ":"), default=str).encode()
    return {
        "persona": persona,
        "blocks": report,
        "total_bytes": len(total_raw),
        "total_gzip_bytes": len(gzip.compress(total_raw)),
        "budget_gzip_bytes": 51200,
        "within_budget": len(gzip.compress(total_raw)) < 51200,
    }


@router.get("/i18n")
def i18n():
    return loader.i18n()
