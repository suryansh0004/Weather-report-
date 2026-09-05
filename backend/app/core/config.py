"""Runtime configuration for the Mausam backend."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


class Settings:
    APP_NAME = "Mausam Adaptive Homepage API"
    APP_VERSION = "1.0.0"
    API_PREFIX = "/api/v1"

    # Ministry of Earth Sciences / IMD attribution
    OWNER = "Ministry of Earth Sciences (MoES) - India Meteorological Department"

    # Cache
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "300"))  # 5-minute TTL
    NOWCAST_TTL_SECONDS = int(os.getenv("NOWCAST_TTL_SECONDS", "60"))

    # Payload optimisation
    GZIP_MIN_SIZE = int(os.getenv("GZIP_MIN_SIZE", "500"))

    # Upstream providers. Left empty in the prototype -> deterministic mock adapters
    # are used, so the app runs fully offline for demo/evaluation.
    IMD_API_BASE = os.getenv("IMD_API_BASE", "")
    CPCB_API_BASE = os.getenv("CPCB_API_BASE", "")
    MOSDAC_API_BASE = os.getenv("MOSDAC_API_BASE", "")
    NDMA_CAP_FEED = os.getenv("NDMA_CAP_FEED", "")

    BHASHINI_ULCA_URL = os.getenv(
        "BHASHINI_ULCA_URL",
        "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline",
    )
    BHASHINI_API_KEY = os.getenv("BHASHINI_API_KEY", "")
    BHASHINI_USER_ID = os.getenv("BHASHINI_USER_ID", "")

    PERSONAS = ("kisan", "commuter", "tourist", "coastal")

    @property
    def live_mode(self) -> bool:
        return bool(self.IMD_API_BASE)


settings = Settings()
