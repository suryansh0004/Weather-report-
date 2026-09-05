"""Rule-based widget ranking engine.

The homepage is not a fixed layout. Every widget carries a base weight per
persona plus a set of situational rules. The engine scores each candidate,
drops the ones that do not apply to the location, and returns an ordered
layout that the client renders top-down. Because the reasoning is returned with
each widget (`why`), the adaptivity is auditable — important for a government
app where users must understand why they are being shown something.

score = base_weight(persona) + Σ rule_boosts − irrelevance_penalty
"""
from __future__ import annotations

from datetime import datetime

from . import advisories, alerts as alerts_svc, aqi as aqi_svc, ocean, travel, urban
from .synoptic import _terrain, current, daily, now_ist, nowcast

# widget id -> (title, base weight per persona)
CATALOG: dict[str, dict] = {
    "emergency": {"title": "Emergency alert", "base": {"kisan": 60, "commuter": 60, "tourist": 60, "coastal": 70}},
    "hero": {"title": "Current weather", "base": {"kisan": 95, "commuter": 95, "tourist": 95, "coastal": 92}},
    "nowcast": {"title": "60-minute rain nowcast", "base": {"kisan": 62, "commuter": 90, "tourist": 58, "coastal": 66}},
    "aqi": {"title": "Air quality", "base": {"kisan": 30, "commuter": 88, "tourist": 55, "coastal": 28}},
    "uv": {"title": "UV index", "base": {"kisan": 34, "commuter": 52, "tourist": 72, "coastal": 40}},
    "agromet": {"title": "GKMS agromet advisory", "base": {"kisan": 92, "commuter": 6, "tourist": 4, "coastal": 30}},
    "soil": {"title": "7-day soil moisture", "base": {"kisan": 84, "commuter": 2, "tourist": 2, "coastal": 12}},
    "spraying": {"title": "Spraying window", "base": {"kisan": 80, "commuter": 2, "tourist": 2, "coastal": 8}},
    "sowing": {"title": "Sowing suitability", "base": {"kisan": 74, "commuter": 2, "tourist": 2, "coastal": 8}},
    "irrigation": {"title": "Irrigation need", "base": {"kisan": 70, "commuter": 2, "tourist": 2, "coastal": 6}},
    "forecast7": {"title": "7-day outlook", "base": {"kisan": 78, "commuter": 60, "tourist": 82, "coastal": 66}},
    "hourly": {"title": "24-hour trend", "base": {"kisan": 58, "commuter": 76, "tourist": 62, "coastal": 58}},
    "waterlogging": {"title": "Waterlogging watch", "base": {"kisan": 14, "commuter": 84, "tourist": 34, "coastal": 44}},
    "routes": {"title": "Route hazards", "base": {"kisan": 12, "commuter": 80, "tourist": 56, "coastal": 30}},
    "itinerary": {"title": "Multi-city itinerary", "base": {"kisan": 4, "commuter": 10, "tourist": 90, "coastal": 8}},
    "hills": {"title": "Mountain hazards", "base": {"kisan": 20, "commuter": 24, "tourist": 78, "coastal": 4}},
    "packing": {"title": "Clothing & packing", "base": {"kisan": 8, "commuter": 30, "tourist": 76, "coastal": 12}},
    "cyclone": {"title": "Cyclone tracker", "base": {"kisan": 30, "commuter": 26, "tourist": 30, "coastal": 96}},
    "sea": {"title": "Sea state & fishermen warning", "base": {"kisan": 10, "commuter": 8, "tourist": 30, "coastal": 94}},
    "evacuation": {"title": "Shelters & helplines", "base": {"kisan": 16, "commuter": 16, "tourist": 20, "coastal": 88}},
    "comfort": {"title": "Commute comfort", "base": {"kisan": 6, "commuter": 82, "tourist": 34, "coastal": 10}},
    "satellite": {"title": "MOSDAC satellite products", "base": {"kisan": 4, "commuter": 4, "tourist": 6, "coastal": 54}},
    "farm_hazards": {"title": "Crop hazard watch", "base": {"kisan": 76, "commuter": 6, "tourist": 6, "coastal": 20}},
}


def build_layout(district: dict, persona: str, when: datetime | None = None) -> dict:
    when = when or now_ist()
    persona = persona if persona in ("kisan", "commuter", "tourist", "coastal") else "commuter"

    cur = current(district, when)
    nc = nowcast(district, when=when)
    air = aqi_svc.snapshot(district, when)
    week = daily(district, days=7, when=when)
    active_alerts = alerts_svc.cap_alerts_for(district, when)
    sev = alerts_svc.severity_score(active_alerts)
    system = ocean.active_system_for(district)
    is_coastal = _terrain(district) == "coastal"
    is_hill = _terrain(district) == "mountain"
    warnings_week = {w for d in week for w in d["warnings"]}

    scores: dict[str, dict] = {}

    def add(wid: str, boost: int = 0, why: str | None = None, drop: bool = False):
        entry = scores.setdefault(
            wid,
            {"id": wid, "title": CATALOG[wid]["title"], "score": CATALOG[wid]["base"][persona], "why": [], "visible": True},
        )
        entry["score"] += boost
        if why:
            entry["why"].append(why)
        if drop:
            entry["visible"] = False

    for wid in CATALOG:
        add(wid)

    # ---- universal severity rules -----------------------------------------
    if active_alerts:
        add("emergency", 40 + sev // 2, f"{len(active_alerts)} active warning(s), top severity {active_alerts[0]['colour']}")
    else:
        add("emergency", 0, "No active warning", drop=True)

    # ---- disaster override -------------------------------------------------
    override = False
    if system or any(a["colour"] == "RED" for a in active_alerts):
        override = True
        add("cyclone", 78 if system else 34, "Active cyclonic system tracked by MOSDAC" if system else "Red CAP warning in force")
        add("evacuation", 66, "Life-safety information promoted by the disaster override")
        add("sea", 40 if is_coastal else -30, "Coastal district under cyclone watch" if is_coastal else "Inland district")
        add("agromet", -20, "Deprioritised during an active emergency")
        add("itinerary", -35, "Travel planning deprioritised during an emergency")
        add("packing", -30, "Deprioritised during an emergency")

    # ---- rain / nowcast rules ---------------------------------------------
    if nc["onset_in_min"] is not None:
        add("nowcast", 30, f"Rain starting in ~{nc['onset_in_min']} min")
        add("waterlogging", 26, "Live rain cell over the district")
        add("routes", 18, "Wet-road hazard for the commute")
        add("comfort", 16, "Departure timing affected by the rain cell")
    if nc["band"] == "heavy":
        add("nowcast", 20, f"Heavy cell, peak {nc['peak_intensity_mmph']} mm/h")
    if cur["rain_prob_24h_pct"] > 60:
        add("hourly", 14, f"{cur['rain_prob_24h_pct']}% rain probability in 24 h")
        add("spraying", 16, "Spray timing is rain-critical today")
    if "heavy_rain" in warnings_week:
        add("forecast7", 16, "Heavy rainfall day in the 7-day window")
        add("farm_hazards", 22, "Lodging / waterlogging risk to standing crop")
        add("hills", 20 if is_hill else 0, "Cumulative rain raises landslide risk" if is_hill else None)

    # ---- air quality rules -------------------------------------------------
    if air["aqi"] > 200:
        add("aqi", 34, f"AQI {air['aqi']} - {air['category']}")
        add("packing", 10, "Mask recommended for outdoor exposure")
    elif air["aqi"] > 100:
        add("aqi", 16, f"AQI {air['aqi']} - {air['category']}")
    else:
        add("aqi", -6, f"AQI {air['aqi']} - {air['category']}")

    # ---- heat / cold rules -------------------------------------------------
    if "heatwave" in warnings_week:
        add("hero", 4, "Heatwave conditions")
        add("irrigation", 22, "Evapotranspiration demand elevated by heat")
        add("farm_hazards", 18, "Heat stress and flower drop risk")
        add("uv", 16, "High solar load")
    if "frost" in warnings_week:
        add("farm_hazards", 26, "Frost warning for standing vegetables")
        add("packing", 14, "Sub-zero night temperatures")
    if cur["uv_index"] >= 8:
        add("uv", 18, f"UV index {cur['uv_index']} - very high")

    # ---- visibility rules --------------------------------------------------
    if cur["visibility_km"] < 2:
        add("routes", 24, f"Visibility {cur['visibility_km']} km")
        add("hills", 16 if is_hill else 0, "Fog on hill roads" if is_hill else None)

    # ---- geography relevance ----------------------------------------------
    if not is_coastal:
        add("sea", -80, "Not a coastal district", drop=not override)
        if not system:
            add("cyclone", -80, "No cyclonic system within 450 km", drop=True)
            add("evacuation", -60, "No evacuation trigger", drop=True)
    if not is_hill:
        add("hills", -55, "No hill terrain in this district", drop=persona != "tourist")
    if district["id"] not in urban.WATERLOG_SPOTS and persona != "commuter":
        add("waterlogging", -12, "No chronic waterlogging inventory for this district")

    # ---- soil / crop rules -------------------------------------------------
    sm = week[0]["soil_moisture_pct"]
    if sm < 30:
        add("soil", 18, f"Soil moisture {sm}% - deficit")
        add("irrigation", 24, "Pre-sowing / life-saving irrigation advised")
    elif sm > 85:
        add("soil", 14, f"Soil moisture {sm}% - saturated")
        add("sowing", -14, "Field too wet for sowing operations")

    # ---- persona relevance pruning ----------------------------------------
    # A widget whose persona weight is negligible, and which no situational rule
    # promoted, would only add scroll depth on a 2G handset. Prune it so the
    # homepage stays as short as the situation allows.
    for wid, entry in scores.items():
        if wid in ("hero", "emergency") or not entry["visible"]:
            continue
        base = CATALOG[wid]["base"][persona]
        if base < 30 and entry["score"] <= base:
            entry["visible"] = False
            entry["why"].append(f"Low relevance for the {persona} persona")

    ordered = sorted(
        (w for w in scores.values() if w["visible"]),
        key=lambda w: -w["score"],
    )
    for rank, w in enumerate(ordered, start=1):
        w["rank"] = rank
        w["score"] = max(0, min(160, w["score"]))
        if not w["why"]:
            w["why"] = [f"Standard for the {persona} persona"]

    return {
        "persona": persona,
        "emergency_override": override,
        "severity_score": sev,
        "widgets": ordered,
        "signals": {
            "alerts_active": len(active_alerts),
            "top_alert_colour": active_alerts[0]["colour"] if active_alerts else None,
            "rain_onset_min": nc["onset_in_min"],
            "nowcast_band": nc["band"],
            "aqi": air["aqi"],
            "aqi_category": air["category"],
            "uv_index": cur["uv_index"],
            "visibility_km": cur["visibility_km"],
            "soil_moisture_pct": sm,
            "week_warnings": sorted(warnings_week),
            "terrain": _terrain(district),
            "cyclone": system["name"] if system else None,
        },
    }


def persona_payload(district: dict, persona: str, when: datetime | None = None) -> dict:
    """The persona-specific data blocks referenced by the ranked widgets."""
    when = when or now_ist()
    if persona == "kisan":
        return _with_disaster_blocks(district, persona, advisories.kisan_pack(district, when), when)
    if persona == "commuter":
        return _with_disaster_blocks(district, persona, urban.commuter_pack(district, when), when)
    if persona == "tourist":
        return _with_disaster_blocks(district, persona, travel.tourist_pack(district, None, when), when)
    if persona == "coastal":
        return ocean.coastal_pack(district, when)
    return {}


def _with_disaster_blocks(district: dict, persona: str, pack: dict, when: datetime) -> dict:
    """Universal override: life-safety data is attached to every persona.

    When a cyclone is being tracked or a RED CAP warning is in force, the ranking
    engine promotes the cyclone / sea / shelter widgets for *any* persona, so the
    matching data blocks have to travel with the payload as well.
    """
    if persona == "coastal":
        return pack
    active = alerts_svc.cap_alerts_for(district, when)
    if not (ocean.active_system_for(district) or any(a["colour"] == "RED" for a in active)):
        return pack
    pack = dict(pack)  # never mutate a memoised persona pack in place
    marine = ocean.coastal_pack(district, when)
    for key in ("active_system", "sea_state", "evacuation", "satellite_products", "is_coastal"):
        if key in marine and key not in pack:
            pack[key] = marine[key]
    return pack
