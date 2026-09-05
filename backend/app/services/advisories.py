"""Kisan (farmer) intelligence: GKMS advisory + derived agromet indices."""
from __future__ import annotations

from datetime import datetime, timedelta

from ..data import loader
from .synoptic import _rng, _terrain, daily, hourly, now_ist, soil_moisture_for

SEASON = {
    (6, 7, 8, 9, 10): "Kharif",
    (11, 12, 1, 2, 3): "Rabi",
    (4, 5): "Zaid",
}


def season_for(month: int) -> str:
    for months, name in SEASON.items():
        if month in months:
            return name
    return "Kharif"


def spraying_window(district: dict, when: datetime | None = None) -> dict:
    """Finds the best contiguous 3-hour window for pesticide application.

    Suitability follows the standard agronomic thresholds: wind 3-12 km/h,
    no rain within 6 hours, temperature below 35 C, humidity below 85 %.
    """
    when = when or now_ist()
    hrs = hourly(district, hours=24, when=when)
    scored = []
    for i, h in enumerate(hrs):
        rain_soon = max((x["rain_prob_pct"] for x in hrs[i : i + 6]), default=0)
        score = 100
        reasons = []
        if h["wind_kmph"] > 12:
            score -= (h["wind_kmph"] - 12) * 6
            reasons.append("high wind - drift risk")
        if h["wind_kmph"] < 3:
            score -= 15
            reasons.append("too calm - poor canopy penetration")
        if rain_soon > 40:
            score -= rain_soon * 0.9
            reasons.append("wash-off risk")
        if h["temp_c"] > 35:
            score -= (h["temp_c"] - 35) * 8
            reasons.append("evaporation loss")
        if h["humidity_pct"] > 85:
            score -= 12
            reasons.append("slow drying")
        hour = int(h["hour"][:2])
        if hour < 6 or hour > 19:
            score -= 40
            reasons.append("outside daylight hours")
        scored.append({**h, "score": max(0, int(score)), "reasons": reasons})
    best = max(scored, key=lambda s: s["score"])
    idx = scored.index(best)
    window = scored[idx : idx + 3]
    end = (datetime.fromisoformat(window[-1]["time"]) + timedelta(hours=1)).strftime("%H:%M")
    return {
        "suitable": best["score"] >= 60,
        "score": best["score"],
        "window_start": best["hour"],
        "window_end": end,
        "verdict": (
            "Good spraying window" if best["score"] >= 75
            else "Marginal - proceed with care" if best["score"] >= 60
            else "Do not spray"
        ),
        "limiting_factors": best["reasons"],
        "timeline": [{"hour": s["hour"], "score": s["score"]} for s in scored[:18]],
    }


def sowing_index(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    week = daily(district, days=7, when=when)
    sm = soil_moisture_for(district, when)
    rain_7d = round(sum(d["rain_mm"] for d in week), 1)
    tmean = sum((d["temp_max_c"] + d["temp_min_c"]) / 2 for d in week) / len(week)
    score = 50
    notes = []
    if 45 <= sm <= 80:
        score += 25
        notes.append("Soil moisture in the ideal band for seed germination")
    elif sm < 30:
        score -= 25
        notes.append("Soil too dry - pre-sowing irrigation required")
    elif sm > 88:
        score -= 20
        notes.append("Field saturated - wait for drainage")
    if 20 <= rain_7d <= 90:
        score += 18
        notes.append(f"Well-distributed rainfall of {rain_7d} mm expected in 7 days")
    elif rain_7d > 150:
        score -= 22
        notes.append("Excess rainfall likely - seed rot risk")
    if 22 <= tmean <= 32:
        score += 12
        notes.append("Temperature favourable for emergence")
    else:
        score -= 10
        notes.append("Temperature outside the optimal germination band")
    score = max(0, min(100, int(score)))
    return {
        "score": score,
        "band": "Favourable" if score >= 70 else "Marginal" if score >= 45 else "Unfavourable",
        "season": season_for(when.month),
        "soil_moisture_pct": sm,
        "expected_rain_7d_mm": rain_7d,
        "mean_temp_c": round(tmean, 1),
        "notes": notes,
    }


def soil_trend(district: dict, when: datetime | None = None) -> list[dict]:
    when = when or now_ist()
    out = []
    for i in range(-3, 8):
        d = when + timedelta(days=i)
        out.append(
            {
                "date": d.strftime("%Y-%m-%d"),
                "day_label": d.strftime("%a"),
                "moisture_pct": soil_moisture_for(district, d),
                "observed": i <= 0,
            }
        )
    return out


def farm_hazards(district: dict, when: datetime | None = None) -> list[dict]:
    when = when or now_ist()
    week = daily(district, days=7, when=when)
    hazards = []
    for d in week:
        for w in d["warnings"]:
            hazards.append(
                {
                    "type": w,
                    "date": d["date"],
                    "day_label": d["day_label"],
                    "detail": {
                        "heatwave": f"Maximum temperature {d['temp_max_c']} C - crop heat stress and flower drop likely.",
                        "frost": f"Minimum temperature {d['temp_min_c']} C - frost damage risk to standing vegetables.",
                        "heavy_rain": f"{d['rain_mm']} mm rainfall - waterlogging and lodging risk. Clear field drains.",
                        "thunderstorm": "Lightning and gusty winds - suspend field operations and secure equipment.",
                    }[w],
                }
            )
    return hazards[:5]


def gkms_bulletin(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    data = loader.agromet()
    rec = data["district_advisories"].get(district["id"], data["default_advisory"])
    season = season_for(when.month)
    crops = rec["kharif_crops"] if season in ("Kharif", "Zaid") else rec["rabi_crops"]
    last_bulletin = when - timedelta(days=(when.weekday() - 1) % 3)
    return {
        "district": district["district"],
        "state": district["state"],
        "agro_climatic_zone": district.get("agro_zone"),
        "amfu": rec["amfu"],
        "issuing_authority": data["issuing_authority"],
        "issued_on": last_bulletin.strftime("%Y-%m-%d"),
        "valid_till": (last_bulletin + timedelta(days=5)).strftime("%Y-%m-%d"),
        "season": season,
        "crops_in_field": crops,
        "advisories": rec["advisories"],
        "livestock": rec["livestock"],
        "horticulture": rec["horticulture"],
    }


def kisan_pack(district: dict, when: datetime | None = None) -> dict:
    when = when or now_ist()
    return {
        "bulletin": gkms_bulletin(district, when),
        "spraying": spraying_window(district, when),
        "sowing": sowing_index(district, when),
        "soil_trend": soil_trend(district, when),
        "hazards": farm_hazards(district, when),
        "irrigation": _irrigation(district, when),
    }


def _irrigation(district: dict, when: datetime) -> dict:
    sm = soil_moisture_for(district, when)
    week = daily(district, days=3, when=when)
    rain_3d = round(sum(d["rain_mm"] for d in week), 1)
    et0 = round(3.2 + (5.5 if _terrain(district) == "arid" else 0) + _rng(district["id"], "et0").random() * 1.6, 1)
    need = max(0.0, round(et0 * 3 - rain_3d - (sm - 45) * 0.4, 1))
    return {
        "reference_et0_mm_day": et0,
        "expected_rain_3d_mm": rain_3d,
        "soil_moisture_pct": sm,
        "irrigation_need_mm": need,
        "recommendation": (
            "No irrigation needed - forecast rainfall covers crop demand." if need <= 0
            else f"Apply about {need} mm ({round(need/25,1)} hours of 25 mm/h flow) after the rain window closes."
        ),
    }
