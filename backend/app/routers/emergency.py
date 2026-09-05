"""NDMA CAP emergency alert endpoints + MOSDAC cyclone feed."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..services import alerts as alerts_svc
from ..services import geo, ocean

router = APIRouter(tags=["alerts"])


@router.get("/alerts/emergency", summary="Active CAP alerts (NDMA Sachet / IMD IBF profile)")
def emergency(
    lat: float | None = Query(None, ge=6.0, le=37.5, description="Omit lat/lon for the national feed"),
    lon: float | None = Query(None, ge=68.0, le=97.5),
    district: str | None = Query(None),
):
    if district:
        rec = geo.by_district_name(district)
    elif lat is not None and lon is not None:
        rec = geo.resolve(lat, lon)
    else:
        feed = alerts_svc.national_feed()
        return {"scope": "national", "count": len(feed), "alerts": feed}

    alerts = alerts_svc.cap_alerts_for(rec) if rec else []
    return {
        "scope": "district",
        "district": rec["district"] if rec else None,
        "state": rec["state"] if rec else None,
        "count": len(alerts),
        "severity_score": alerts_svc.severity_score(alerts),
        "push_required": bool(alerts) and alerts[0]["colour"] in ("RED", "ORANGE"),
        "sticky_banner": bool(alerts) and alerts[0]["colour"] == "RED",
        "alerts": alerts,
    }


@router.get("/alerts/cyclone", summary="ISRO MOSDAC cyclone trajectory & sea state")
def cyclone(
    lat: float = Query(..., ge=6.0, le=37.5),
    lon: float = Query(..., ge=68.0, le=97.5),
):
    rec = geo.resolve(lat, lon)
    return {"district": rec["district"], **ocean.coastal_pack(rec)}
