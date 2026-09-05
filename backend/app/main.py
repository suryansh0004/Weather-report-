"""Mausam Adaptive Homepage API — FastAPI application entrypoint.

SIH26076 · Ministry of Earth Sciences / India Meteorological Department.

Run:  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from .core.config import settings
from .routers import advisories, emergency, system, voice, weather

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Persona-adaptive, low-bandwidth, offline-first weather API for the IMD 'Mausam' app. "
        "Endpoints return IMD-schema observations, CPCB AQI, GKMS agromet advisories, "
        "ISRO MOSDAC cyclone tracks and NDMA CAP alerts, plus a rule-based widget "
        "ranking that reorders the mobile homepage per persona and per active severity."
    ),
    contact={"name": settings.OWNER},
    docs_url="/docs",
    redoc_url="/redoc",
)

# gzip delta compression — every JSON body above 500 B is compressed.
app.add_middleware(GZipMiddleware, minimum_size=settings.GZIP_MIN_SIZE, compresslevel=6)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Response-Time-Ms", "X-Payload-Bytes", "X-Data-Mode"],
)


@app.middleware("http")
async def instrument(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Response-Time-Ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
    response.headers["X-Data-Mode"] = "live" if settings.live_mode else "mock"
    response.headers["Cache-Control"] = f"public, max-age={settings.CACHE_TTL_SECONDS}"
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):  # pragma: no cover
    return JSONResponse(status_code=500, content={"error": type(exc).__name__, "detail": str(exc)})


for r in (weather.router, advisories.router, emergency.router, voice.router, system.router):
    app.include_router(r, prefix=settings.API_PREFIX)


@app.get("/", tags=["system"], summary="Service index")
def index():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "problem_statement": "SIH26076 - Personalized 'Mausam' App Homepage",
        "owner": settings.OWNER,
        "docs": "/docs",
        "endpoints": {
            "adaptive_homepage": f"{settings.API_PREFIX}/weather/homepage?lat=26.8467&lon=80.9462&persona=kisan&lang=hi",
            "current": f"{settings.API_PREFIX}/weather/current?lat=26.8467&lon=80.9462&persona=kisan",
            "hourly": f"{settings.API_PREFIX}/weather/forecast/hourly?lat=26.8467&lon=80.9462",
            "daily": f"{settings.API_PREFIX}/weather/forecast/daily?lat=26.8467&lon=80.9462",
            "nowcast": f"{settings.API_PREFIX}/weather/nowcast?lat=19.076&lon=72.8777",
            "aqi": f"{settings.API_PREFIX}/weather/aqi?lat=28.6139&lon=77.209",
            "agromet": f"{settings.API_PREFIX}/advisories/agromet?district=Ludhiana",
            "emergency": f"{settings.API_PREFIX}/alerts/emergency?lat=19.8135&lon=85.8312",
            "cyclone": f"{settings.API_PREFIX}/alerts/cyclone?lat=19.8135&lon=85.8312",
            "voice": f"{settings.API_PREFIX}/voice/bulletin?lat=26.8467&lon=80.9462&persona=kisan&lang=hi",
            "delta_sync": f"POST {settings.API_PREFIX}/system/sync",
            "payload_report": f"{settings.API_PREFIX}/system/payload-report",
        },
    }


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
