"""Tourist & Traveller intelligence: itinerary tracking, hill hazards, packing."""
from __future__ import annotations

from datetime import datetime, timedelta

from ..data import loader
from .geo import by_district_name
from .synoptic import _rng, _terrain, current, daily, now_ist

DEFAULT_ITINERARY = {
    "mountain": ["Shimla", "Dehradun", "Gangtok", "Srinagar"],
    "coastal": ["North Goa", "Ernakulam", "Puri", "Chennai"],
    "plain": ["New Delhi", "Jaipur", "Lucknow", "Kolkata"],
    "plateau": ["Bengaluru Urban", "Hyderabad", "Pune", "Bhopal"],
    "arid": ["Jaipur", "Ahmedabad", "New Delhi", "Bhopal"],
}


def itinerary(district: dict, cities: list[str] | None = None, when: datetime | None = None) -> list[dict]:
    when = when or now_ist()
    names = cities or [district["district"]] + [c for c in DEFAULT_ITINERARY[_terrain(district)] if c != district["district"]][:3]
    out = []
    for i, name in enumerate(names[:5]):
        rec = by_district_name(name)
        if not rec:
            continue
        leg_day = when + timedelta(days=i)
        cur = current(rec, leg_day)
        day = daily(rec, days=1, when=leg_day)[0]
        out.append(
            {
                "leg": i + 1,
                "city": rec["district"],
                "state": rec["state"],
                "date": leg_day.strftime("%Y-%m-%d"),
                "day_label": "Today" if i == 0 else leg_day.strftime("%a %d %b"),
                "temp_max_c": day["temp_max_c"],
                "temp_min_c": day["temp_min_c"],
                "sky_code": day["sky_code"],
                "rain_prob_pct": day["rain_prob_pct"],
                "visibility_km": cur["visibility_km"],
                "uv_index": cur["uv_index"],
                "verdict": _verdict(day, cur),
            }
        )
    return out


def _verdict(day: dict, cur: dict) -> str:
    if day["rain_prob_pct"] > 70 or "heavy_rain" in day["warnings"]:
        return "Plan indoor sightseeing"
    if "heatwave" in day["warnings"]:
        return "Sightseeing only before 11:00"
    if cur["visibility_km"] < 1.5:
        return "Poor visibility - viewpoints not advised"
    if day["rain_prob_pct"] < 25 and cur["uv_index"] < 8:
        return "Excellent for outdoor plans"
    return "Good, carry light rain protection"


def mountain_hazards(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    week = daily(district, days=3, when=when)
    cum_rain = round(sum(d["rain_mm"] for d in week), 1)
    cur = current(district, when)
    hill = _terrain(district) == "mountain"
    r = _rng(district["id"], when.strftime("%Y-%m-%d"), "hill")
    landslide_score = min(100, int(cum_rain * (1.35 if hill else 0.3) + (18 if hill else 0) + r.random() * 12))
    fog_score = int(max(0, min(100, (10 - cur["visibility_km"]) * 11 + (12 if hill else 0))))
    snow = hill and cur["temp_min_c"] <= 1.5
    return {
        "applicable": hill,
        "cumulative_rain_72h_mm": cum_rain,
        "landslide": {
            "score": landslide_score,
            "band": "High" if landslide_score > 65 else "Moderate" if landslide_score > 35 else "Low",
            "advice": (
                "Avoid night travel on hill roads; do not halt below cut slopes."
                if landslide_score > 65
                else "Check road status before departure."
                if landslide_score > 35
                else "No elevated risk reported on main corridors."
            ),
        },
        "visibility": {
            "km": cur["visibility_km"],
            "score": fog_score,
            "band": "Very poor" if cur["visibility_km"] < 1 else "Poor" if cur["visibility_km"] < 3 else "Fair" if cur["visibility_km"] < 6 else "Good",
        },
        "snow_risk": snow,
        "snow_note": "Snowfall possible above 2200 m - carry chains and check pass closures." if snow else None,
        "trek_window": "06:00-11:00 IST" if landslide_score > 35 else "06:00-16:00 IST",
    }


def packing(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    cur = current(district, when)
    week = daily(district, days=3, when=when)
    items: list[str] = []
    tmin = min(d["temp_min_c"] for d in week)
    tmax = max(d["temp_max_c"] for d in week)
    rain = max(d["rain_prob_pct"] for d in week)
    if tmin < 8:
        items += ["Heavy jacket / thermal layer", "Woollen cap and gloves"]
    elif tmin < 16:
        items += ["Light fleece or sweater"]
    if tmax > 36:
        items += ["Loose cotton clothing", "Wide-brim hat", "ORS sachets"]
    if rain > 50:
        items += ["Compact umbrella / poncho", "Waterproof footwear", "Dry bag for electronics"]
    if cur["uv_index"] >= 6:
        items += [f"Sunscreen SPF 50 (UV index {cur['uv_index']})", "UV sunglasses"]
    if cur["visibility_km"] < 3:
        items += ["Reflective jacket for road travel"]
    if _terrain(district) == "mountain":
        items += ["Non-slip trekking shoes", "Power bank - charging points are sparse"]
    if _terrain(district) == "coastal":
        items += ["Quick-dry clothing - humidity above 75 %", "Insect repellent"]
    if not items:
        items = ["Light layers are sufficient", "Reusable water bottle"]
    return {
        "temp_band_c": [round(tmin, 1), round(tmax, 1)],
        "clothing_index": "Cold" if tmin < 10 else "Cool" if tmin < 18 else "Warm" if tmax < 36 else "Hot",
        "items": items[:7],
    }


def tourist_pack(district: dict, cities: list[str] | None = None, when: datetime | None = None) -> dict:
    when = when or now_ist()
    return {
        "itinerary": itinerary(district, cities, when),
        "mountain": mountain_hazards(district, when),
        "packing": packing(district, when),
    }
