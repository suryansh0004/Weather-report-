"""Weather endpoints, including the composite adaptive-homepage endpoint."""
from __future__ import annotations

import hashlib
import json

from fastapi import APIRouter, HTTPException, Query

from ..core import cache
from ..core.config import settings
from ..data import loader
from ..services import alerts as alerts_svc
from ..services import aqi as aqi_svc
from ..services import bhashini, geo, persona_engine, synoptic

router = APIRouter(prefix="/weather", tags=["weather"])


def _location(lat: float, lon: float) -> dict:
    d = geo.resolve(lat, lon)
    if not d:
        raise HTTPException(404, "No IMD district could be resolved for these coordinates")
    return d


def _loc_block(d: dict) -> dict:
    return {
        "district": d["district"],
        "district_id": d["id"],
        "state": d["state"],
        "lat": d["lat"],
        "lon": d["lon"],
        "terrain": d["terrain"],
        "agro_zone": d["agro_zone"],
        "imd_station": d["imd_station"],
        "distance_km": d.get("distance_km"),
        "languages": d.get("languages", ["hi", "en"]),
    }


@router.get("/current", summary="Current observation, persona-tagged")
def current(
    lat: float = Query(..., ge=6.0, le=37.5, description="Latitude (India bounding box)"),
    lon: float = Query(..., ge=68.0, le=97.5, description="Longitude (India bounding box)"),
    persona: str = Query("commuter", description="kisan | commuter | tourist | coastal"),
):
    key = f"mausam:current:{round(lat,2)}:{round(lon,2)}:{persona}"
    hit = cache.get(key)
    if hit:
        hit["meta"]["cache"] = "HIT"
        return hit
    d = _location(lat, lon)
    cur = synoptic.current(d)
    air = aqi_svc.snapshot(d)
    active = alerts_svc.cap_alerts_for(d)
    payload = {
        "location": _loc_block(d),
        "observation": cur,
        "air_quality": {
            "aqi": air["aqi"],
            "category": air["category"],
            "colour": air["colour"],
            "dominant_pollutant": air["dominant_pollutant"],
            "station": air["station"],
        },
        "uv": aqi_svc.uv_band(cur["uv_index"]),
        "alerts_active": len(active),
        "top_alert": active[0]["headline"] if active else None,
        "persona": persona,
        "meta": {"source": settings.OWNER, "mode": "live" if settings.live_mode else "mock", "cache": "MISS"},
    }
    cache.set(key, payload)
    return payload


@router.get("/forecast/hourly", summary="Hour-by-hour forecast")
def forecast_hourly(
    lat: float = Query(..., ge=6.0, le=37.5),
    lon: float = Query(..., ge=68.0, le=97.5),
    hours: int = Query(24, ge=3, le=72),
):
    key = f"mausam:hourly:{round(lat,2)}:{round(lon,2)}:{hours}"
    hit = cache.get(key)
    if hit:
        return hit
    d = _location(lat, lon)
    payload = {"location": _loc_block(d), "hours": synoptic.hourly(d, hours), "meta": {"cache": "MISS"}}
    cache.set(key, payload)
    return payload


@router.get("/forecast/daily", summary="7-day district outlook")
def forecast_daily(
    lat: float = Query(..., ge=6.0, le=37.5),
    lon: float = Query(..., ge=68.0, le=97.5),
    days: int = Query(7, ge=1, le=10),
):
    d = _location(lat, lon)
    return {"location": _loc_block(d), "days": synoptic.daily(d, days)}


@router.get("/nowcast", summary="60-minute hyperlocal precipitation nowcast")
def nowcast(
    lat: float = Query(..., ge=6.0, le=37.5),
    lon: float = Query(..., ge=68.0, le=97.5),
    minutes: int = Query(60, ge=15, le=120),
):
    key = f"mausam:nowcast:{round(lat,2)}:{round(lon,2)}:{minutes}"
    hit = cache.get(key)
    if hit:
        return hit
    d = _location(lat, lon)
    payload = {"location": _loc_block(d), "nowcast": synoptic.nowcast(d, minutes)}
    cache.set(key, payload, ttl=settings.NOWCAST_TTL_SECONDS)
    return payload


@router.get("/aqi", summary="CPCB National Air Quality Index")
def aqi(lat: float = Query(..., ge=6.0, le=37.5), lon: float = Query(..., ge=68.0, le=97.5)):
    d = _location(lat, lon)
    return {"location": _loc_block(d), "air_quality": aqi_svc.snapshot(d)}


@router.get("/homepage", summary="Adaptive homepage: ranked widgets + persona data in one round trip")
def homepage(
    lat: float = Query(..., ge=6.0, le=37.5),
    lon: float = Query(..., ge=68.0, le=97.5),
    persona: str = Query("commuter"),
    lang: str = Query("hi"),
):
    """Single low-bandwidth call that drives the whole dashboard.

    One round trip is deliberate: on a 2G link, four separate requests cost more
    in handshakes than the payload itself.
    """
    key = f"mausam:home:{round(lat,2)}:{round(lon,2)}:{persona}:{lang}"
    hit = cache.get(key)
    if hit:
        hit["meta"]["cache"] = "HIT"
        return hit

    d = _location(lat, lon)
    cur = synoptic.current(d)
    air = aqi_svc.snapshot(d)
    layout = persona_engine.build_layout(d, persona)
    active = alerts_svc.cap_alerts_for(d)

    payload = {
        "location": _loc_block(d),
        "issued_at": cur["observed_at"],
        "observation": cur,
        "uv": aqi_svc.uv_band(cur["uv_index"]),
        "air_quality": air,
        "hourly": synoptic.hourly(d, 24),
        "daily": synoptic.daily(d, 7),
        "alerts": active,
        "layout": layout,
        "persona_data": persona_engine.persona_payload(d, layout["persona"]),
        "voice": bhashini.compose(d, layout["persona"], lang),
        "meta": {
            "source": settings.OWNER,
            "mode": "live" if settings.live_mode else "mock",
            "cache": "MISS",
            "ttl_seconds": settings.CACHE_TTL_SECONDS,
        },
    }
    raw = json.dumps(payload, separators=(",", ":"), default=str)
    payload["meta"]["etag"] = hashlib.sha1(raw.encode()).hexdigest()[:16]
    payload["meta"]["uncompressed_bytes"] = len(raw)
    cache.set(key, payload)
    return payload
