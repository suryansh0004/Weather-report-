"""Loads the bundled mock datasets once at import time."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent


def _read(name: str):
    with open(DATA_DIR / name, encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=1)
def districts() -> list[dict]:
    return _read("districts.json")


@lru_cache(maxsize=1)
def agromet() -> dict:
    return _read("agromet.json")


@lru_cache(maxsize=1)
def cap_alerts() -> dict:
    return _read("cap_alerts.json")


@lru_cache(maxsize=1)
def mosdac() -> dict:
    return _read("mosdac.json")


@lru_cache(maxsize=1)
def i18n() -> dict:
    return _read("i18n.json")


@lru_cache(maxsize=1)
def district_index() -> dict[str, dict]:
    return {d["id"]: d for d in districts()}
