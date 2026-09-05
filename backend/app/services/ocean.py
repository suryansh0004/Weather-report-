"""Coastal & Disaster mode: MOSDAC cyclone track + sea state for fishermen."""
from __future__ import annotations

from datetime import datetime

from ..data import loader
from .geo import haversine_km
from .synoptic import _rng, _terrain, now_ist


def active_system_for(district: dict) -> dict | None:
    data = loader.mosdac()
    for system in data["active_systems"]:
        cur = system["current"]
        dist = haversine_km(district["lat"], district["lon"], cur["lat"], cur["lon"])
        if district["id"] in system["affected_geocodes"] or dist < 450:
            return {**system, "distance_from_you_km": round(dist, 1)}
    return None


def sea_state(district: dict, when: datetime | None = None) -> dict | None:
    when = when or now_ist()
    if _terrain(district) != "coastal":
        return None
    bulletins = loader.mosdac()["coastal_bulletins"]
    rec = bulletins.get(district["id"])
    if rec is None:
        r = _rng(district["id"], "sea")
        wave = round(1.2 + r.random() * 2.2, 1)
        rec = {
            "wave_height_m": wave,
            "sea_condition": "Rough" if wave > 2.5 else "Moderate",
            "high_tide": ["12:00 IST", "00:20 IST"],
            "fishermen_warning": "No specific warning in force. Monitor updates before sailing.",
        }
    return {
        **rec,
        "district": district["district"],
        "issued_by": "INCOIS / IMD Area Cyclone Warning Centre (mock feed)",
        "updated_at": when.isoformat(),
        "safe_to_sail": rec["wave_height_m"] < 2.5 and "not to venture" not in rec["fishermen_warning"].lower() and "suspend" not in rec["fishermen_warning"].lower(),
    }


def coastal_pack(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    system = active_system_for(district)
    return {
        "satellite_products": loader.mosdac()["satellite_products"],
        "active_system": system,
        "sea_state": sea_state(district, when),
        "is_coastal": _terrain(district) == "coastal",
        "evacuation": _evacuation(district, system),
    }


def _evacuation(district: dict, system: dict | None) -> dict | None:
    if not system:
        return None
    cur = system["current"]
    return {
        "trigger": f"{system['name']} - landfall {cur['landfall_zone']}",
        "landfall_eta": cur["expected_landfall"],
        "shelters_nearby": [
            f"{district['district']} Multipurpose Cyclone Shelter (MPCS-1)",
            f"{district['district']} Govt. Higher Secondary School shelter",
            f"{district['district']} Panchayat Bhavan relief centre",
        ],
        "helplines": [
            {"label": "NDMA / Sachet", "number": "1078"},
            {"label": "State Emergency Operation Centre", "number": "1070"},
            {"label": "Coast Guard distress", "number": "1554"},
            {"label": "Disaster helpline", "number": "112"},
        ],
        "checklist": [
            "Move boats and nets to designated harbour moorings",
            "Charge phones, keep a battery radio and torch ready",
            "Store 3 days of drinking water and dry food",
            "Keep ID, land records and medicines in a waterproof bag",
            "Follow only official IMD / NDMA bulletins",
        ],
    }
