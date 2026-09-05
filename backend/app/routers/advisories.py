"""GKMS agromet advisory endpoints (Kisan mode)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..core import cache
from ..services import advisories as svc
from ..services import geo
from ..services.synoptic import now_ist

router = APIRouter(prefix="/advisories", tags=["advisories"])


def _resolve(district: str | None, lat: float | None, lon: float | None) -> dict:
    if district:
        rec = geo.by_district_name(district)
        if not rec:
            raise HTTPException(404, f"District '{district}' is not in the GKMS district list")
        return rec
    if lat is not None and lon is not None:
        return geo.resolve(lat, lon)
    raise HTTPException(400, "Provide either ?district= or ?lat=&lon=")


@router.get("/agromet", summary="District Agromet Advisory Bulletin (GKMS)")
def agromet(
    district: str | None = Query(None, description="District name or IMD district id"),
    lat: float | None = Query(None, ge=6.0, le=37.5),
    lon: float | None = Query(None, ge=68.0, le=97.5),
):
    rec = _resolve(district, lat, lon)
    key = f"mausam:agromet:{rec['id']}"
    hit = cache.get(key)
    if hit:
        hit["meta"]["cache"] = "HIT"
        return hit
    payload = {
        "location": {"district": rec["district"], "state": rec["state"], "district_id": rec["id"], "agro_zone": rec["agro_zone"]},
        **svc.kisan_pack(rec),
        "meta": {"cache": "MISS"},
    }
    cache.set(key, payload)
    return payload


@router.get("/spraying", summary="Best pesticide spraying window in the next 24 hours")
def spraying(
    district: str | None = Query(None),
    lat: float | None = Query(None),
    lon: float | None = Query(None),
):
    rec = _resolve(district, lat, lon)
    return {"district": rec["district"], "spraying": svc.spraying_window(rec)}


@router.get("/soil-moisture", summary="7-day soil moisture trend (0-30 cm layer)")
def soil(
    district: str | None = Query(None),
    lat: float | None = Query(None),
    lon: float | None = Query(None),
):
    rec = _resolve(district, lat, lon)
    return {"district": rec["district"], "trend": svc.soil_trend(rec), "irrigation": svc._irrigation(rec, now_ist())}
