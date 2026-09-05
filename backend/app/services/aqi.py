"""CPCB National Air Quality Index.

Sub-indices are computed with the official CPCB breakpoints (CPCB AQI, 2014) so
the number shown on the dashboard is derived, not invented. Pollutant
concentrations come from the deterministic mock station adapter; wiring the real
CPCB / OpenAQ feed only means replacing `_concentrations`.
"""
from __future__ import annotations

from datetime import datetime

from .synoptic import _jitter, _rng, _terrain, now_ist

# pollutant: [(c_low, c_high, i_low, i_high), ...]
BREAKPOINTS = {
    "pm25": [(0, 30, 0, 50), (30, 60, 50, 100), (60, 90, 100, 200), (90, 120, 200, 300), (120, 250, 300, 400), (250, 500, 400, 500)],
    "pm10": [(0, 50, 0, 50), (50, 100, 50, 100), (100, 250, 100, 200), (250, 350, 200, 300), (350, 430, 300, 400), (430, 600, 400, 500)],
    "no2": [(0, 40, 0, 50), (40, 80, 50, 100), (80, 180, 100, 200), (180, 280, 200, 300), (280, 400, 300, 400), (400, 600, 400, 500)],
    "so2": [(0, 40, 0, 50), (40, 80, 50, 100), (80, 380, 100, 200), (380, 800, 200, 300), (800, 1600, 300, 400), (1600, 2400, 400, 500)],
    "co": [(0, 1, 0, 50), (1, 2, 50, 100), (2, 10, 100, 200), (10, 17, 200, 300), (17, 34, 300, 400), (34, 50, 400, 500)],
    "o3": [(0, 50, 0, 50), (50, 100, 50, 100), (100, 168, 100, 200), (168, 208, 200, 300), (208, 748, 300, 400), (748, 1000, 400, 500)],
}

CATEGORIES = [
    (50, "Good", "#2ecc71", "Air quality is satisfactory; minimal impact."),
    (100, "Satisfactory", "#a3d977", "Minor breathing discomfort to sensitive people."),
    (200, "Moderate", "#f5d13b", "Breathing discomfort for people with lung or heart disease."),
    (300, "Poor", "#f39c12", "Breathing discomfort to most people on prolonged exposure."),
    (400, "Very Poor", "#e74c3c", "Respiratory illness on prolonged exposure."),
    (10**9, "Severe", "#8e44ad", "Affects healthy people; serious impact on those with existing disease."),
]

# Urban load multiplier by terrain/urbanisation for the mock station
_LOAD = {"plain": 1.0, "arid": 0.95, "plateau": 0.72, "coastal": 0.6, "mountain": 0.35}


def _sub_index(pollutant: str, conc: float) -> int:
    for c_lo, c_hi, i_lo, i_hi in BREAKPOINTS[pollutant]:
        if c_lo <= conc <= c_hi:
            return round(i_lo + (i_hi - i_lo) * (conc - c_lo) / (c_hi - c_lo))
    return 500


def category(aqi: int) -> dict:
    for limit, name, colour, advice in CATEGORIES:
        if aqi <= limit:
            return {"name": name, "colour": colour, "health_advice": advice}
    return {"name": "Severe", "colour": "#8e44ad", "health_advice": ""}


def _concentrations(district: dict, when: datetime) -> dict[str, float]:
    load = _LOAD[_terrain(district)]
    r = _rng(district["id"], when.strftime("%Y-%m-%d-%H"), "aqi")
    # winter inversion raises particulates sharply; monsoon scavenges them
    season = {12: 2.3, 1: 2.4, 2: 1.7, 3: 1.3, 4: 1.2, 5: 1.1, 6: 0.7, 7: 0.45, 8: 0.42, 9: 0.55, 10: 1.2, 11: 2.0}[when.month]
    diurnal = 1.35 if when.hour in (7, 8, 9, 19, 20, 21, 22) else 0.85
    base_pm25 = 34 * load * season * diurnal * (0.8 + r.random() * 0.5)
    return {
        "pm25": round(base_pm25, 1),
        "pm10": round(base_pm25 * (1.9 + r.random() * 0.5), 1),
        "no2": round(18 * load * diurnal * (0.7 + r.random()), 1),
        "so2": round(10 * load * (0.6 + r.random() * 0.8), 1),
        "co": round(0.7 * load * diurnal * (0.7 + r.random()), 2),
        "o3": round(38 * (0.6 + r.random() * 0.9) * (1.3 if 11 <= when.hour <= 16 else 0.7), 1),
    }


def snapshot(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    conc = _concentrations(district, when)
    subs = {p: _sub_index(p, v) for p, v in conc.items()}
    dominant = max(subs, key=lambda p: subs[p])
    aqi = subs[dominant]
    cat = category(aqi)
    hist = []
    for h in range(23, -1, -1):
        t = when.replace(minute=0) - __import__("datetime").timedelta(hours=h)
        c = _concentrations(district, t)
        hist.append({"hour": t.strftime("%H:%M"), "aqi": max(_sub_index(p, v) for p, v in c.items())})
    return {
        "station": district.get("cpcb_station"),
        "updated_at": when.isoformat(),
        "aqi": aqi,
        "category": cat["name"],
        "colour": cat["colour"],
        "health_advice": cat["health_advice"],
        "dominant_pollutant": dominant.upper().replace("PM25", "PM2.5"),
        "concentrations_ug_m3": conc,
        "sub_indices": subs,
        "trend_24h": hist,
        "mask_advised": aqi > 200,
        "outdoor_exercise_ok": aqi <= 100,
    }


def uv_band(uv: float) -> dict:
    if uv < 3:
        return {"band": "Low", "colour": "#2ecc71", "advice": "No protection needed."}
    if uv < 6:
        return {"band": "Moderate", "colour": "#f5d13b", "advice": "Wear sunglasses; use SPF 30 at midday."}
    if uv < 8:
        return {"band": "High", "colour": "#f39c12", "advice": "Seek shade 11:00-16:00; SPF 30+ and a hat."}
    if uv < 11:
        return {"band": "Very High", "colour": "#e74c3c", "advice": "Avoid midday sun; SPF 50, cover arms."}
    return {"band": "Extreme", "colour": "#8e44ad", "advice": "Avoid outdoor exposure at midday entirely."}
