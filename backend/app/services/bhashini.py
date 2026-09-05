"""Bhashini multilingual voice bulletin composer.

Pipeline:
  1. Compose a strictly 2-line, plain-language bulletin from the ranked data.
  2. If BHASHINI_API_KEY is configured, request the ULCA TTS pipeline for the
     target language and return base64 audio.
  3. Otherwise return `engine="web-speech"` and let the client synthesise with
     the browser SpeechSynthesis API using the returned `speech_locale`.

Keeping the text composition server-side means the same bulletin is spoken in
all 14 languages and can be cached / delta-synced like any other payload.
"""
from __future__ import annotations

from datetime import datetime

from ..core.config import settings
from ..data import loader
from . import advisories, alerts as alerts_svc, aqi as aqi_svc, ocean, travel
from .synoptic import _terrain, current, now_ist, nowcast


def languages() -> list[dict]:
    return loader.i18n()["languages"]


def _lang(code: str) -> dict:
    for entry in languages():
        if entry["code"] == code:
            return entry
    return languages()[0]


def _t(section: str, key: str, code: str) -> str:
    block = loader.i18n()[section].get(key, {})
    return block.get(code) or block.get("en") or key


def compose(district: dict, persona: str, lang: str = "hi", when: datetime | None = None) -> dict:
    when = when or now_ist()
    meta = _lang(lang)
    code = meta["code"]
    cur = current(district, when)
    air = aqi_svc.snapshot(district, when)
    nc = nowcast(district, when=when)
    active = alerts_svc.cap_alerts_for(district, when)

    sky_text = _t("sky", cur["sky_code"], code)
    line1 = _t("templates", "line1", code).format(
        place=district["district"],
        sky=sky_text,
        temp=int(round(cur["temp_c"])),
        humidity=cur["humidity_pct"],
    )

    if persona == "kisan":
        spray = advisories.spraying_window(district, when)
        verdict_key = "good" if spray["score"] >= 75 else "marginal" if spray["score"] >= 60 else "no"
        advice = _t("spray_verdict", verdict_key, code)
        if verdict_key != "no":
            advice += f" ({spray['window_start']}-{spray['window_end']})"
        line2 = _t("templates", "kisan", code).format(rain=cur["rain_prob_24h_pct"], advice=advice)
    elif persona == "commuter":
        line2 = _t("templates", "commuter", code).format(
            aqi=air["aqi"],
            aqi_cat=_t("aqi_category", air["category"], code),
            nowcast=max(s["prob_pct"] for s in nc["steps"]),
        )
    elif persona == "tourist":
        pack = travel.packing(district, when)
        line2 = _t("templates", "tourist", code).format(
            comfort=_t("clothing", pack["clothing_index"], code),
            visibility=cur["visibility_km"],
            advice="",
        ).strip()
    else:
        sea = ocean.sea_state(district, when)
        if sea:
            line2 = _t("templates", "coastal", code).format(
                sea=sea["sea_condition"], wave=sea["wave_height_m"], advice=sea["fishermen_warning"]
            )
        else:
            line2 = _t("templates", "no_alert", code)

    prefix = ""
    if active:
        event_name = _t("events", active[0]["event_code"], code)
        if event_name == active[0]["event_code"]:
            event_name = active[0]["event"]
        prefix = _t("templates", "alert_prefix", code).format(event=event_name) + " "

    text = (prefix + line1 + " " + line2).strip()
    return {
        "language": code,
        "language_native": meta["native"],
        "speech_locale": meta["speech_locale"],
        "bhashini_code": meta["bhashini_code"],
        "engine": "bhashini-ulca" if settings.BHASHINI_API_KEY else "web-speech",
        "lines": [prefix + line1 if prefix else line1, line2],
        "text": text,
        "chars": len(text),
        "audio_base64": _synthesise(text, meta) if settings.BHASHINI_API_KEY else None,
        "pipeline": {
            "endpoint": settings.BHASHINI_ULCA_URL,
            "task": "tts",
            "source_language": "en",
            "target_language": meta["bhashini_code"],
            "note": "Set BHASHINI_API_KEY and BHASHINI_USER_ID to stream real ULCA audio; the client falls back to the browser SpeechSynthesis API otherwise.",
        },
    }


def _synthesise(text: str, meta: dict) -> str | None:  # pragma: no cover - needs live key
    """Calls the Bhashini ULCA TTS pipeline. Returns base64 wav or None."""
    try:
        import httpx

        payload = {
            "pipelineTasks": [
                {"taskType": "tts", "config": {"language": {"sourceLanguage": meta["bhashini_code"]}, "gender": "female"}}
            ],
            "inputData": {"input": [{"source": text}]},
        }
        headers = {
            "Authorization": settings.BHASHINI_API_KEY,
            "userID": settings.BHASHINI_USER_ID,
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=8.0) as client:
            res = client.post(settings.BHASHINI_ULCA_URL, json=payload, headers=headers)
            res.raise_for_status()
            body = res.json()
            return body["pipelineResponse"][0]["audio"][0]["audioContent"]
    except Exception:
        return None
