"""Bhashini voice-bulletin endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..services import bhashini, geo

router = APIRouter(prefix="/voice", tags=["voice"])


@router.get("/languages", summary="Supported Indic languages (Bhashini codes + speech locales)")
def langs():
    return {"count": len(bhashini.languages()), "languages": bhashini.languages()}


@router.get("/bulletin", summary="2-line conversational weather bulletin for TTS")
def bulletin(
    lat: float = Query(..., ge=6.0, le=37.5),
    lon: float = Query(..., ge=68.0, le=97.5),
    persona: str = Query("kisan"),
    lang: str = Query("hi", description="hi, en, bn, mr, te, ta, gu, kn, ml, pa, or, as, ur, ne"),
):
    rec = geo.resolve(lat, lon)
    return {"district": rec["district"], **bhashini.compose(rec, persona, lang)}
