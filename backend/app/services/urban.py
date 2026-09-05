"""Daily Commuter intelligence: waterlogging watch, route hazards, comfort."""
from __future__ import annotations

from datetime import datetime

from .synoptic import _rng, now_ist, nowcast, current, hourly

# Chronic waterlogging locations reported by municipal disaster-control rooms.
WATERLOG_SPOTS = {
    "IN-MH-MUM": ["Hindmata, Dadar", "Sion Circle", "Andheri Subway", "King's Circle", "Milan Subway"],
    "IN-DL-NDL": ["Minto Bridge", "Pul Prahladpur", "Zakhira Underpass", "Azad Market Underpass"],
    "IN-WB-KOL": ["Thanthania, College Street", "Muktaram Babu Street", "Behala Chowrasta", "Amherst Street"],
    "IN-TN-CHN": ["Velachery Main Road", "Pulianthope", "Mudichur Road", "Ashok Nagar 11th Avenue"],
    "IN-KA-BLR": ["Silk Board Junction", "Bellandur Outer Ring Road", "KR Circle", "Sarjapur Road"],
    "IN-UP-LKO": ["Hazratganj Crossing", "Nishatganj Underpass", "Alambagh Bus Stand Road", "Faizabad Road"],
    "IN-TG-HYD": ["Nala at Khairatabad", "Malakpet Underbridge", "Kukatpally Y Junction"],
    "IN-GJ-AMD": ["Sarkhej Circle", "Chandola Talav Road", "Vasna Barrage Road"],
    "IN-BR-PAT": ["Rajendra Nagar", "Kankarbagh", "Bhootnath Road"],
    "IN-AS-GHY": ["Anil Nagar", "Zoo Road Tiniali", "Rukminigaon"],
}

CORRIDORS = {
    "IN-MH-MUM": ["Western Express Highway", "Eastern Freeway", "Sion-Panvel Highway", "Harbour Line"],
    "IN-DL-NDL": ["Ring Road", "NH-48 Gurugram stretch", "Noida Link Road", "Yellow Line Metro"],
    "IN-UP-LKO": ["Shaheed Path", "Kanpur Road NH-27", "Sitapur Road", "Lucknow Metro Red Line"],
    "IN-KA-BLR": ["Outer Ring Road", "Hosur Road", "Tumkur Road", "Purple Line Metro"],
}
DEFAULT_CORRIDORS = ["City ring road", "National highway approach", "Arterial bypass", "Suburban transit"]


def _spots(district: dict) -> list[str]:
    return WATERLOG_SPOTS.get(district["id"], [f"{district['district']} main market underpass", f"{district['district']} railway underbridge"])


def waterlogging(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    nc = nowcast(district, when=when)
    cur = current(district, when)
    load = nc["peak_intensity_mmph"] * 6 + cur["rain_last_24h_mm"] * 0.6
    spots = []
    for i, name in enumerate(_spots(district)):
        r = _rng(district["id"], name, when.strftime("%Y-%m-%d-%H"))
        local = load * (0.75 + r.random() * 0.6)
        level = "high" if local > 22 else "moderate" if local > 10 else "low" if local > 3 else "clear"
        spots.append(
            {
                "location": name,
                "risk": level,
                "expected_depth_cm": int(max(0, min(90, local * 2.4))),
                "advice": {
                    "high": "Avoid - likely impassable for two-wheelers and hatchbacks.",
                    "moderate": "Expect slow-moving traffic and standing water.",
                    "low": "Passable; drive with caution near kerbs.",
                    "clear": "No accumulation reported.",
                }[level],
            }
        )
    worst = max(spots, key=lambda s: s["expected_depth_cm"]) if spots else None
    return {
        "municipal_source": f"{district['district']} Municipal Corporation flood-control room (mock)",
        "updated_at": when.isoformat(),
        "overall_risk": worst["risk"] if worst else "clear",
        "spots": sorted(spots, key=lambda s: -s["expected_depth_cm"]),
    }


def route_hazards(district: dict, when: datetime | None = None) -> list[dict]:
    when = when or now_ist()
    cur = current(district, when)
    hrs = hourly(district, hours=6, when=when)
    routes = CORRIDORS.get(district["id"], DEFAULT_CORRIDORS)
    out = []
    for name in routes:
        r = _rng(district["id"], name, when.strftime("%Y-%m-%d-%H"))
        rain_soon = max(h["rain_prob_pct"] for h in hrs)
        hazards = []
        if cur["visibility_km"] < 2:
            hazards.append("Low visibility - use fog lamps")
        if rain_soon > 60:
            hazards.append("Wet carriageway - increase headway")
        if cur["gust_kmph"] > 45:
            hazards.append("Crosswind gusts - risk for high-sided vehicles")
        if cur["sky_code"] == "thunderstorm":
            hazards.append("Lightning - avoid open flyovers")
        if not hazards and r.random() > 0.7:
            hazards.append("Localised construction diversion")
        delay = int(len(hazards) * (6 + r.random() * 12))
        out.append(
            {
                "route": name,
                "status": "severe" if delay > 24 else "caution" if delay > 8 else "clear",
                "expected_delay_min": delay,
                "hazards": hazards or ["No weather hazard reported"],
            }
        )
    return out


def commute_comfort(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    cur = current(district, when)
    nc = nowcast(district, when=when)
    umbrella = nc["onset_in_min"] is not None or cur["rain_prob_24h_pct"] > 45
    return {
        "umbrella_needed": umbrella,
        "best_departure": _best_departure(district, when),
        "two_wheeler_advice": (
            "Carry a raincoat - rain expected within the hour." if nc["onset_in_min"] is not None
            else "Conditions acceptable for two-wheeler travel."
        ),
        "headline": (
            f"Rain starting in about {nc['onset_in_min']} minutes" if nc["onset_in_min"] is not None
            else "No rain expected in the next 60 minutes"
        ),
    }


def _best_departure(district: dict, when: datetime) -> dict:
    hrs = hourly(district, hours=8, when=when)
    best = min(hrs, key=lambda h: h["rain_prob_pct"] + max(0, h["temp_c"] - 33) * 4)
    return {"hour": best["hour"], "rain_prob_pct": best["rain_prob_pct"], "temp_c": best["temp_c"]}


def commuter_pack(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    return {
        "nowcast": nowcast(district, when=when),
        "waterlogging": waterlogging(district, when),
        "routes": route_hazards(district, when),
        "comfort": commute_comfort(district, when),
    }
