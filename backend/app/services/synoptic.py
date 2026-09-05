"""Deterministic synthetic weather engine.

Every value is generated from a hash of (district, day, hour) so the dashboard is
stable across reloads yet different per location — which makes the persona
ranking engine demonstrable without a live IMD key. Swapping in the real IMD
Open Data endpoints only requires replacing the four `fetch_*` adapters in
`providers.py`; the response schema below already mirrors the IMD City Weather
and GKMS bulletin field names.
"""
from __future__ import annotations

import hashlib
import math
import random
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))

# --- climatology tables (monthly normals, Jan..Dec) -------------------------
TMAX = {
    "plain": [23, 26, 33, 39, 41, 39, 34, 33, 33, 33, 29, 24],
    "coastal": [29, 30, 32, 33, 34, 33, 30, 30, 31, 32, 32, 30],
    "plateau": [28, 31, 34, 36, 36, 32, 28, 28, 29, 30, 29, 28],
    "arid": [24, 27, 33, 38, 41, 40, 36, 34, 35, 34, 30, 26],
    "mountain": [10, 12, 17, 22, 26, 26, 23, 22, 22, 20, 16, 12],
}
DIURNAL = {"plain": 12, "coastal": 7, "plateau": 11, "arid": 14, "mountain": 9}
RAIN_P = {
    "plain": [10, 8, 8, 8, 12, 40, 70, 72, 58, 20, 6, 6],
    "coastal": [8, 6, 6, 8, 20, 70, 86, 80, 66, 35, 15, 8],
    "plateau": [6, 5, 6, 8, 15, 55, 72, 70, 52, 22, 8, 5],
    "arid": [8, 6, 5, 6, 10, 30, 55, 50, 32, 10, 4, 5],
    "mountain": [25, 25, 30, 25, 25, 45, 76, 75, 52, 20, 10, 18],
}
HUMID = {"plain": 58, "coastal": 72, "plateau": 55, "arid": 38, "mountain": 62}

SKY_ORDER = [
    "clear",
    "partly_cloudy",
    "cloudy",
    "haze",
    "fog",
    "light_rain",
    "moderate_rain",
    "heavy_rain",
    "thunderstorm",
]


def now_ist() -> datetime:
    return datetime.now(IST)


def _rng(*parts) -> random.Random:
    seed = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()
    return random.Random(int(seed[:12], 16))


def _jitter(district: dict, salt: str, spread: float) -> float:
    r = _rng(district["id"], salt)
    return (r.random() - 0.5) * 2 * spread


def _terrain(district: dict) -> str:
    return district.get("terrain", "plain") if district.get("terrain") in TMAX else "plain"


def _rain_prob(district: dict, when: datetime) -> int:
    t = _terrain(district)
    base = RAIN_P[t][when.month - 1]
    r = _rng(district["id"], when.strftime("%Y-%m-%d"), "rainp")
    day_mod = (r.random() - 0.45) * 55
    # convective diurnal peak in the late afternoon
    hour_mod = 14 * math.sin(max(0.0, math.sin((when.hour - 6) / 24 * math.pi)) * math.pi / 2)
    return int(max(0, min(98, base + day_mod + hour_mod)))


def _sky_for(district: dict, when: datetime, rain_prob: int) -> str:
    r = _rng(district["id"], when.strftime("%Y-%m-%d-%H"), "sky")
    roll = r.random() * 100
    if rain_prob > 78:
        return "thunderstorm" if roll > 55 else "heavy_rain"
    if rain_prob > 60:
        return "moderate_rain" if roll > 35 else "light_rain"
    if rain_prob > 40:
        return "light_rain" if roll > 55 else "cloudy"
    if rain_prob > 22:
        return "cloudy" if roll > 45 else "partly_cloudy"
    if when.month in (11, 12, 1) and when.hour in (0, 1, 2, 3, 4, 5, 6, 7, 22, 23):
        return "fog" if _terrain(district) in ("plain", "mountain") else "haze"
    if _terrain(district) in ("plain", "arid") and roll > 78:
        return "haze"
    return "clear" if roll > 45 else "partly_cloudy"


def _temp_at(district: dict, when: datetime) -> float:
    t = _terrain(district)
    tmax = TMAX[t][when.month - 1] + _jitter(district, "tmax", 1.8)
    amp = DIURNAL[t] / 2
    mean = tmax - amp
    # peak at 15:00 IST, trough at 05:00 IST
    phase = (when.hour + when.minute / 60 - 15) / 24 * 2 * math.pi
    val = mean + amp * math.cos(phase)
    val += _jitter(district, when.strftime("%Y-%m-%d") + "tj", 1.2)
    if _sky_for(district, when, _rain_prob(district, when)).endswith("rain"):
        val -= 2.4
    return round(val, 1)


def _humidity(district: dict, when: datetime, rain_prob: int) -> int:
    base = HUMID[_terrain(district)]
    monsoon = 9 if when.month in (6, 7, 8, 9) else 0
    val = base + monsoon + rain_prob * 0.12 - (when.hour - 5) * 0.35
    val += _jitter(district, "hum", 6)
    return int(max(12, min(96, val)))


def _wind(district: dict, when: datetime, rain_prob: int) -> tuple[float, int, float]:
    r = _rng(district["id"], when.strftime("%Y-%m-%d-%H"), "wind")
    base = 8 + r.random() * 14
    if _terrain(district) == "coastal":
        base += 6
    if rain_prob > 70:
        base += 12
    direction = int(r.random() * 360)
    gust = base * (1.4 + r.random() * 0.5)
    return round(base, 1), direction, round(gust, 1)


def _feels_like(temp: float, humidity: int, wind: float) -> float:
    if temp >= 27:  # heat index approximation
        return round(temp + 0.35 * (humidity - 40) / 10 * (temp - 25) / 10 + 0.6, 1)
    if temp <= 10:  # wind chill approximation
        return round(temp - wind * 0.12, 1)
    return round(temp, 1)


def compass(deg: int) -> str:
    pts = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    return pts[int((deg + 11.25) % 360 // 22.5)]


def _uv(district: dict, when: datetime, sky: str) -> float:
    base = 11 - abs(when.hour - 13) * 1.6
    if _terrain(district) == "mountain":
        base += 1.6
    if sky in ("cloudy", "moderate_rain", "heavy_rain", "thunderstorm"):
        base -= 4
    elif sky in ("light_rain", "haze", "fog"):
        base -= 2.5
    return round(max(0.0, min(13.0, base)), 1)


def _visibility(sky: str, humidity: int) -> float:
    table = {
        "clear": 10.0,
        "partly_cloudy": 9.0,
        "cloudy": 8.0,
        "haze": 3.2,
        "fog": 0.4,
        "light_rain": 6.5,
        "moderate_rain": 4.0,
        "heavy_rain": 1.8,
        "thunderstorm": 2.2,
    }
    return round(max(0.2, table.get(sky, 8.0) - (humidity - 70) * 0.02), 1)


def _rain_mm(rain_prob: int, sky: str, rng: random.Random) -> float:
    if sky == "heavy_rain":
        return round(12 + rng.random() * 30, 1)
    if sky == "thunderstorm":
        return round(8 + rng.random() * 26, 1)
    if sky == "moderate_rain":
        return round(3.5 + rng.random() * 8, 1)
    if sky == "light_rain":
        return round(0.4 + rng.random() * 3, 1)
    return 0.0 if rain_prob < 45 else round(rng.random() * 0.6, 1)


# --- public API -------------------------------------------------------------

def current(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    rp = _rain_prob(district, when)
    sky = _sky_for(district, when, rp)
    temp = _temp_at(district, when)
    hum = _humidity(district, when, rp)
    wind, wdir, gust = _wind(district, when, rp)
    rng = _rng(district["id"], when.strftime("%Y-%m-%d-%H"), "cur")
    tmax = max(_temp_at(district, when.replace(hour=h, minute=0)) for h in range(24))
    tmin = min(_temp_at(district, when.replace(hour=h, minute=0)) for h in range(24))
    normal = TMAX[_terrain(district)][when.month - 1]
    return {
        "observed_at": when.isoformat(),
        "station": district.get("imd_station"),
        "sky_code": sky,
        "temp_c": temp,
        "feels_like_c": _feels_like(temp, hum, wind),
        "temp_max_c": round(tmax, 1),
        "temp_min_c": round(tmin, 1),
        "departure_from_normal_c": round(tmax - normal, 1),
        "humidity_pct": hum,
        "dew_point_c": round(temp - (100 - hum) / 5, 1),
        "pressure_hpa": round(1004 + _jitter(district, "pres", 8) - (2 if rp > 70 else 0), 1),
        "wind_kmph": wind,
        "wind_dir_deg": wdir,
        "wind_dir": compass(wdir),
        "gust_kmph": gust,
        "visibility_km": _visibility(sky, hum),
        "uv_index": _uv(district, when, sky),
        "rain_last_24h_mm": round(rng.random() * (40 if rp > 60 else 6), 1),
        "rain_prob_24h_pct": rp,
        "sunrise": (when.replace(hour=5, minute=52) + timedelta(minutes=int(_jitter(district, "sr", 22)))).strftime("%H:%M"),
        "sunset": (when.replace(hour=18, minute=24) + timedelta(minutes=int(_jitter(district, "ss", 22)))).strftime("%H:%M"),
    }


def hourly(district: dict, hours: int = 24, when: datetime | None = None) -> list[dict]:
    when = (when or now_ist()).replace(minute=0, second=0, microsecond=0)
    out = []
    for i in range(hours):
        t = when + timedelta(hours=i)
        rp = _rain_prob(district, t)
        sky = _sky_for(district, t, rp)
        rng = _rng(district["id"], t.strftime("%Y-%m-%d-%H"), "hr")
        wind, wdir, _ = _wind(district, t, rp)
        out.append(
            {
                "time": t.isoformat(),
                "hour": t.strftime("%H:%M"),
                "temp_c": _temp_at(district, t),
                "sky_code": sky,
                "rain_prob_pct": rp,
                "rain_mm": _rain_mm(rp, sky, rng),
                "wind_kmph": wind,
                "wind_dir": compass(wdir),
                "humidity_pct": _humidity(district, t, rp),
            }
        )
    return out


def daily(district: dict, days: int = 7, when: datetime | None = None) -> list[dict]:
    when = (when or now_ist()).replace(hour=0, minute=0, second=0, microsecond=0)
    out = []
    for i in range(days):
        d = when + timedelta(days=i)
        hours = [d.replace(hour=h) for h in range(0, 24, 3)]
        temps = [_temp_at(district, h) for h in hours]
        probs = [_rain_prob(district, h) for h in hours]
        rng = _rng(district["id"], d.strftime("%Y-%m-%d"), "day")
        rp = max(probs)
        sky = _sky_for(district, d.replace(hour=14), rp)
        mm = round(sum(_rain_mm(p, _sky_for(district, h, p), _rng(district["id"], h.strftime("%Y-%m-%d-%H"), "hr")) for h, p in zip(hours, probs)), 1)
        tmax, tmin = max(temps), min(temps)
        warnings = []
        if tmax >= TMAX[_terrain(district)][d.month - 1] + 4.5:
            warnings.append("heatwave")
        if tmin <= 2.5:
            warnings.append("frost")
        if mm >= 64.5:
            warnings.append("heavy_rain")
        if sky == "thunderstorm":
            warnings.append("thunderstorm")
        out.append(
            {
                "date": d.strftime("%Y-%m-%d"),
                "day_label": d.strftime("%a"),
                "temp_max_c": round(tmax, 1),
                "temp_min_c": round(tmin, 1),
                "sky_code": sky,
                "rain_prob_pct": rp,
                "rain_mm": mm,
                "humidity_pct": _humidity(district, d.replace(hour=8), rp),
                "wind_kmph": _wind(district, d.replace(hour=14), rp)[0],
                "soil_moisture_pct": soil_moisture_for(district, d),
                "warnings": warnings,
                "sunshine_hours": round(max(0.5, 11 - rp / 12 - rng.random()), 1),
            }
        )
    return out


def soil_moisture_for(district: dict, day: datetime) -> int:
    """0-100 % of field capacity in the 0-30 cm layer."""
    t = _terrain(district)
    base = {"plain": 52, "coastal": 64, "plateau": 45, "arid": 28, "mountain": 58}[t]
    seasonal = 18 if day.month in (7, 8, 9) else (-8 if day.month in (3, 4, 5) else 0)
    r = _rng(district["id"], day.strftime("%Y-%m-%d"), "soil")
    return int(max(6, min(98, base + seasonal + (r.random() - 0.5) * 22)))


def nowcast(district: dict, minutes: int = 60, when: datetime | None = None) -> dict:
    """5-minute-step hyperlocal precipitation nowcast (IMD Nowcast/DWR style)."""
    when = when or now_ist()
    rp = _rain_prob(district, when)
    rng = _rng(district["id"], when.strftime("%Y-%m-%d-%H"), "now")
    onset = None
    steps = []
    # a cell that may pass over the location in the next hour
    peak_at = int(rng.random() * minutes)
    active = rp > 45 or rng.random() > 0.72
    for m in range(0, minutes + 1, 5):
        if active:
            spread = 18.0
            intensity = (rp / 12) * math.exp(-((m - peak_at) ** 2) / (2 * spread**2))
            intensity = round(max(0.0, intensity + (rng.random() - 0.5) * 0.4), 2)
        else:
            intensity = 0.0
        prob = int(min(97, max(0, intensity * 26 + (rp * 0.25 if active else rp * 0.08))))
        if onset is None and intensity >= 0.4:
            onset = m
        steps.append({"offset_min": m, "intensity_mmph": intensity, "prob_pct": prob})
    peak = max(steps, key=lambda s: s["intensity_mmph"])
    return {
        "issued_at": when.isoformat(),
        "valid_minutes": minutes,
        "radar_station": f"DWR-{district['id'][-3:]}",
        "steps": steps,
        "onset_in_min": onset,
        "in_progress": steps[0]["intensity_mmph"] >= 0.4,
        "peak_intensity_mmph": peak["intensity_mmph"],
        "peak_in_min": peak["offset_min"],
        "band": (
            "no_rain" if peak["intensity_mmph"] < 0.3
            else "light" if peak["intensity_mmph"] < 2.5
            else "moderate" if peak["intensity_mmph"] < 7.5
            else "heavy"
        ),
        "echo_top_km": round(4 + rng.random() * 9, 1),
        "cell_movement": f"{compass(int(rng.random()*360))} at {int(18 + rng.random()*22)} km/h",
    }
