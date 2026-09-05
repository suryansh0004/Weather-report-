"""NDMA / IMD CAP alert aggregation and severity scoring."""
from __future__ import annotations

from datetime import datetime

from ..data import loader
from .synoptic import _terrain, current, daily, now_ist, nowcast

SEVERITY_RANK = {"Extreme": 4, "Severe": 3, "Moderate": 2, "Minor": 1, "Unknown": 0}
COLOUR_RANK = {"RED": 4, "ORANGE": 3, "YELLOW": 2, "GREEN": 1}


def _applies(alert: dict, district: dict) -> bool:
    area = alert["info"]["area"]
    if district["id"] in area.get("geocode", []):
        return True
    if district.get("terrain") in area.get("terrain_scope", []):
        return True
    return False


def _expired(alert: dict, when: datetime) -> bool:
    try:
        return datetime.fromisoformat(alert["info"]["expires"]) < when
    except Exception:
        return False


def cap_alerts_for(district: dict, when: datetime | None = None) -> list[dict]:
    when = when or now_ist()
    out = []
    for alert in loader.cap_alerts()["alerts"]:
        if _applies(alert, district) and not _expired(alert, when):
            out.append(_flatten(alert))
    out += _derived(district, when)
    out.sort(key=lambda a: (-COLOUR_RANK.get(a["colour"], 0), -SEVERITY_RANK.get(a["severity"], 0)))
    return out


def _flatten(alert: dict) -> dict:
    info = alert["info"]
    return {
        "identifier": alert["identifier"],
        "sender": alert["sender"],
        "source": alert["source"],
        "sent": alert["sent"],
        "expires": info["expires"],
        "event": info["event"],
        "event_code": info["eventCode"],
        "category": info["category"],
        "urgency": info["urgency"],
        "severity": info["severity"],
        "certainty": info["certainty"],
        "colour": info["colour"],
        "response_type": info["responseType"],
        "headline": info["headline"],
        "headline_hi": info.get("headline_hi"),
        "description": info["description"],
        "instruction": info["instruction"],
        "instruction_hi": info.get("instruction_hi"),
        "area": info["area"]["areaDesc"],
        "origin": "CAP",
    }


def _derived(district: dict, when: datetime) -> list[dict]:
    """Auto-generated impact alerts from the live/nowcast fields.

    This is what makes the emergency banner respond to the data rather than only
    to the static CAP file — the ranking engine consumes both identically.
    """
    out = []
    nc = nowcast(district, when=when)
    cur = current(district, when)
    if nc["band"] == "heavy" and nc["onset_in_min"] is not None:
        out.append(
            {
                "identifier": f"AUTO-NOWCAST-{district['id']}",
                "sender": "nowcast@imd.gov.in",
                "source": f"Doppler Weather Radar {nc['radar_station']}",
                "sent": when.isoformat(),
                "expires": when.isoformat(),
                "event": "Intense Rain Cell Approaching",
                "event_code": "NOWCAST_RAIN",
                "category": "Met",
                "urgency": "Immediate",
                "severity": "Severe",
                "certainty": "Observed",
                "colour": "ORANGE",
                "response_type": "Shelter",
                "headline": f"Intense rain cell reaching your location in about {nc['onset_in_min']} minutes ({nc['peak_intensity_mmph']} mm/h peak)",
                "headline_hi": f"लगभग {nc['onset_in_min']} मिनट में तेज़ बारिश का दौर आपके स्थान पर पहुँचेगा",
                "description": f"Radar echo top {nc['echo_top_km']} km, cell moving {nc['cell_movement']}.",
                "instruction": "Move indoors within the next few minutes. Avoid underpasses and trees.",
                "instruction_hi": "अगले कुछ मिनटों में घर के अंदर चले जाएँ। अंडरपास और पेड़ों से बचें।",
                "area": district["district"],
                "origin": "DERIVED",
            }
        )
    week = daily(district, days=2, when=when)
    if "heatwave" in week[0]["warnings"] and _terrain(district) != "mountain":
        out.append(
            {
                "identifier": f"AUTO-HEAT-{district['id']}",
                "sender": "alerts@imd.gov.in",
                "source": "IMD Heat Action Plan module",
                "sent": when.isoformat(),
                "expires": when.isoformat(),
                "event": "Heatwave Conditions",
                "event_code": "HEATWAVE",
                "category": "Met",
                "urgency": "Expected",
                "severity": "Moderate",
                "certainty": "Likely",
                "colour": "YELLOW",
                "response_type": "Prepare",
                "headline": f"Maximum temperature {week[0]['temp_max_c']} C - heat stress likely between 12:00 and 16:00 IST",
                "headline_hi": f"अधिकतम तापमान {week[0]['temp_max_c']} डिग्री - दोपहर में लू का प्रभाव",
                "description": "Departure from normal exceeds 4.5 C for the district.",
                "instruction": "Stay hydrated, avoid outdoor work at midday, check on elderly neighbours.",
                "instruction_hi": "पर्याप्त पानी पिएँ, दोपहर में बाहरी काम टालें।",
                "area": district["district"],
                "origin": "DERIVED",
            }
        )
    if cur["visibility_km"] < 0.6:
        out.append(
            {
                "identifier": f"AUTO-FOG-{district['id']}",
                "sender": "alerts@imd.gov.in",
                "source": "IMD Aviation & Surface Visibility module",
                "sent": when.isoformat(),
                "expires": when.isoformat(),
                "event": "Dense Fog",
                "event_code": "FOG",
                "category": "Met",
                "urgency": "Immediate",
                "severity": "Moderate",
                "certainty": "Observed",
                "colour": "YELLOW",
                "response_type": "Avoid",
                "headline": f"Dense fog - visibility down to {int(cur['visibility_km']*1000)} m",
                "headline_hi": f"घना कोहरा - दृश्यता {int(cur['visibility_km']*1000)} मीटर",
                "description": "Surface visibility below 600 m at the reporting station.",
                "instruction": "Use fog lamps and low beam. Expect rail and flight delays.",
                "instruction_hi": "फॉग लैंप का प्रयोग करें। रेल और विमान में देरी संभव।",
                "area": district["district"],
                "origin": "DERIVED",
            }
        )
    return out


def severity_score(alerts: list[dict]) -> int:
    """0-100 composite severity used by the widget ranking engine."""
    if not alerts:
        return 0
    top = alerts[0]
    score = COLOUR_RANK.get(top["colour"], 0) * 20 + SEVERITY_RANK.get(top["severity"], 0) * 5
    if top["urgency"] == "Immediate":
        score += 12
    score += min(12, (len(alerts) - 1) * 4)
    return min(100, score)


def national_feed(when: datetime | None = None) -> list[dict]:
    when = when or now_ist()
    return [_flatten(a) for a in loader.cap_alerts()["alerts"] if not _expired(a, when)]
