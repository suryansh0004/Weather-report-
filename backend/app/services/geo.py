"""Coordinate -> IMD district resolution (haversine nearest-neighbour)."""
from __future__ import annotations

import math

from ..data import loader


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlam / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def resolve(lat: float, lon: float) -> dict:
    """Nearest district record for the supplied GPS fix."""
    best, best_d = None, float("inf")
    for d in loader.districts():
        dist = haversine_km(lat, lon, d["lat"], d["lon"])
        if dist < best_d:
            best, best_d = d, dist
    record = dict(best or {})
    record["distance_km"] = round(best_d, 1)
    record["query"] = {"lat": lat, "lon": lon}
    return record


def by_district_name(name: str) -> dict | None:
    needle = name.strip().lower()
    for d in loader.districts():
        if d["district"].lower() == needle or d["id"].lower() == needle:
            return dict(d)
    for d in loader.districts():
        if needle in d["district"].lower() or needle in d["state"].lower():
            return dict(d)
    return None
