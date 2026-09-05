# Mausam — AI-Powered Adaptive & Personalized Homepage

"Personalized 'Mausam' App Homepage"**, Ministry of Earth Sciences (MoES) / India Meteorological Department (IMD).

A persona-adaptive, low-bandwidth, offline-first weather dashboard that replaces static meteorological tables with a ranked, role-aware widget feed, vernacular voice bulletins in 14 Indic languages, and a delta-sync engine that keeps a full homepage refresh under **4.9 kB gzip**.

---

## 1. What it does

| Persona | Homepage adapts to |
| --- | --- |
| 🌾 **Kisan** (farmer) | GKMS agromet bulletin, 7-day soil-moisture trend, spraying-window suitability, sowing index, irrigation advice, crop hazard watch, rainfall probability |
| 🚗 **Commuter** | 60-minute hyperlocal nowcast radar, CPCB AQI gauge (PM2.5 / PM10 / NO₂ / O₃), UV index, route hazard board, municipal waterlogging watch, commute comfort score |
| 🎒 **Tourist** | Multi-city itinerary weather, mountain hazard panel (landslide risk, fog/snow visibility index), clothing & outdoor activity planner |
| ⚠️ **Coastal / Disaster** (universal override) | ISRO MOSDAC cyclone trajectory, rough-sea & fishermen warnings, evacuation guidance, NDMA CAP sticky red banner — this mode **overrides every other persona** whenever a RED CAP alert or active cyclone is in range |

Cross-cutting features: 1-tap persona switch, 14-language picker (incl. RTL Urdu), Bhashini-style 2-line spoken bulletin, drag/arrow widget reordering with an explainable "Why this order?" panel, dark + light themes, connectivity simulator (4G / 2G / offline), and a payload budget report.

### Choosing your location

The location chip opens a three-way picker, so the app is never limited to demo places:

1. **Search** — type a district, state or agro-climatic zone name and pick from the filtered registry (26 districts seeded; each row shows state, terrain and coordinates).
2. **Use my current location** — `navigator.geolocation` fix, rounded to 4 decimals, resolved server-side to the nearest IMD district. Permission denial, missing GPS and out-of-India positions each get their own message instead of a silent failure.
3. **Manual coordinates** — type any latitude/longitude; validated against India's bounds (lat 6-38, lon 68-98) before the call is made.

Any coordinate is snapped by `services/geo.resolve()` (haversine nearest-neighbour) to the closest district in the registry, so persona ranking, agromet zone and CAP alerts stay consistent. The header chip shows a `GPS` or `COORD` badge whenever the active position came from the device or from manual entry rather than the district list.

---

## 2. Project structure

```
mausam-app/
├── README.md
├── backend/                                 # Python FastAPI async microservice
│   ├── requirements.txt
│   └── app/
│       ├── main.py                          # app factory, GZip middleware, CORS, routers
│       ├── core/
│       │   ├── config.py                    # settings (TTL, budget, Redis URL, districts)
│       │   └── cache.py                     # Redis client + in-memory TTL fallback, ETag helper
│       ├── data/
│       │   ├── loader.py                    # lru_cache'd JSON loaders
│       │   ├── districts.json               # IMD district / station registry
│       │   ├── agromet.json                 # GKMS crop calendars & advisory templates
│       │   ├── cap_alerts.json              # NDMA CAP alert templates (colour-coded)
│       │   ├── mosdac.json                  # ISRO MOSDAC cyclone tracks & satellite products
│       │   └── i18n.json                    # UI strings + spoken-bulletin phrasebook (14 langs)
│       ├── services/
│       │   ├── geo.py                       # lat/lon → nearest IMD district & station
│       │   ├── synoptic.py                  # deterministic observation / hourly / daily engine
│       │   ├── aqi.py                       # CPCB AQI sub-index computation
│       │   ├── advisories.py                # agromet: soil moisture, spraying, sowing, hazards
│       │   ├── urban.py                     # nowcast radar cells, waterlogging, route hazards
│       │   ├── travel.py                    # itinerary, hill hazards, packing planner
│       │   ├── ocean.py                     # sea state, fishermen warnings, cyclone proximity
│       │   ├── alerts.py                    # CAP alert assembly + severity scoring
│       │   ├── persona_engine.py            # ★ rule-based widget scoring / ranking / pruning
│       │   └── bhashini.py                  # 2-line bulletin composer + TTS payload contract
│       └── routers/
│           ├── weather.py                   # current, hourly, daily, nowcast, aqi, homepage
│           ├── advisories.py                # agromet, spraying, soil-moisture
│           ├── emergency.py                 # CAP alerts, cyclone feed
│           ├── voice.py                     # languages, bulletin
│           └── system.py                    # health, cache, districts, sync, payload-report, i18n
└── frontend/                                # React 19 + TypeScript + Vite + Tailwind v3
    ├── index.html
    ├── vite.config.ts / tailwind.config.js / postcss.config.js / tsconfig*.json
    ├── public/{favicon.svg, icons.svg}
    └── src/
        ├── main.tsx
        ├── App.tsx                          # shell, persona/lang/theme state, widget order
        ├── index.css                        # design tokens, dark/light themes, RTL rules
        ├── screens.tsx                      # Nowcast, Agromet, Sync/Offline screens
        ├── components/
        │   ├── shell.tsx                    # TopBar, EmergencyBanner, AlertStrip, BottomNav, useVoice
        │   ├── widgets.tsx                  # all 21 persona widget renderers (hand-rolled SVG)
        │   ├── ui.tsx                        # Card, Meter, Icon sprite, Pill primitives
        │   └── boundary.tsx                 # error boundary with reset
        └── lib/
            ├── api.ts                       # fetch layer + EdgeDriver offline cache + delta sync
            ├── i18n.ts                      # client string table, persona/language registries
            └── types.ts                     # shared response contracts
```

---

## 3. Local run instructions

### 3.1 Backend (FastAPI)

```bash
cd mausam-app/backend
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

* API root: `http://localhost:8000/api/v1`
* Interactive OpenAPI docs: `http://localhost:8000/docs`
* Health probe: `curl http://localhost:8000/api/v1/system/health`

**Redis (optional).** If a Redis server is reachable the service uses it for the 5-minute TTL cache; otherwise it logs a warning and falls back to an in-process TTL dict with the same interface. To enable Redis:

```bash
docker run -p 6379:6379 redis:7-alpine
export MAUSAM_REDIS_URL=redis://localhost:6379/0
```

> Data JSON files and persona packs are `lru_cache`d — restart uvicorn after editing anything under `app/data/`.

### 3.2 Frontend (React + Vite)

```bash
cd mausam-app/frontend
npm install
npm run dev          # http://localhost:5173
# production bundle
npm run build && npm run preview
```

The API base lives in `src/lib/api.ts`. It defaults to `http://localhost:8000`; set the `__PORT_8000__` placeholder or edit the constant to point at a remote backend.

---

## 4. API surface

All routes are prefixed `/api/v1`. Every response is gzip-compressed by middleware and carries an `ETag`.

### Required endpoints (per problem statement)

| Method | Route |
| --- | --- |
| GET | `/weather/current?lat={lat}&lon={lon}&persona={role}` |
| GET | `/weather/forecast/hourly?lat={lat}&lon={lon}` |
| GET | `/advisories/agromet?district={district}` |
| GET | `/alerts/emergency` — NDMA CAP disaster push triggers |

### Additional endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/weather/homepage?lat=&lon=&persona=&lang=` | **single low-bandwidth call** that returns the entire dashboard: `location`, `observation`, `uv`, `air_quality`, `hourly`, `daily`, `alerts`, `layout`, `persona_data`, `voice`, `meta` |
| GET | `/weather/forecast/daily` | 7-day district forecast |
| GET | `/weather/nowcast` | 60-minute radar cells + intensity timeline |
| GET | `/weather/aqi` | CPCB station AQI with sub-indices |
| GET | `/advisories/spraying` | spraying-window suitability |
| GET | `/advisories/soil-moisture` | 7-day soil-moisture trend |
| GET | `/alerts/cyclone` | MOSDAC cyclone trajectory & sea state |
| GET | `/voice/languages` · `/voice/bulletin` | supported locales, 2-line spoken bulletin |
| POST | `/system/sync` | delta synchronisation (see §6) |
| GET | `/system/health` · `/system/cache` · `/system/districts` · `/system/payload-report` · `/system/i18n` | ops & diagnostics |
| POST | `/system/cache/flush` | clear the server cache |

Demo coordinates: Lucknow `26.8467, 80.9462` (kisan) · Mumbai `19.0760, 72.8777` (commuter, active override) · Puri `19.8135, 85.8312` (coastal, Cyclonic Storm *MITHILA*, RED) · Shimla `31.1048, 77.1734` (tourist) · Delhi `28.6139, 77.2090`.

---

## 5. Module 1 — Persona engine (rule-based widget ranking)

`app/services/persona_engine.py` implements a transparent, auditable scoring pass — no black box:

1. **Catalog.** Each of the 21 widgets carries a per-persona base weight (0–100).
2. **Severity boosts.** Live signals add weight: rain onset within 60 min boosts `nowcast` and `comfort`; AQI > 150 boosts `aqi`; soil moisture below the crop threshold boosts `irrigation`; cyclone within range boosts `cyclone` (+78) and `evacuation` (+66).
3. **Relevance pruning.** Widgets whose base weight is under 30 for the active persona and receive no positive boost are dropped with a stated reason, so the grid never renders an empty card.
4. **Emergency override.** A RED CAP alert or an active cyclone promotes the disaster stack to the top of *any* persona and merges the disaster data blocks (`active_system`, `sea_state`, `evacuation`, `satellite_products`) into that persona's pack.
5. **Explainability.** Every widget returns `score`, `rank` and a `why[]` array of human-readable reasons, surfaced in the UI by the "Why this order?" toggle alongside a `signals` summary (`severity 62/100 · nowcast moderate · AQI 48 · soil 61%`).

Caching: responses are keyed by `district:persona:lang:hour-slot` with a 300 s TTL in Redis (or the in-memory fallback), plus `GZipMiddleware` on every route.

---

## 6. Module 3 — Low-bandwidth & offline edge sync

* **Payload budget.** `GET /system/payload-report` measures every block. Full kisan homepage: **17,830 B raw → 4,903 B gzip**, against the 51,200 B (50 kB) budget — ~90 % headroom. The Sync screen renders this as a live budget bar chart.
* **Delta sync.** `POST /system/sync` with `{lat, lon, persona, lang, blocks: {name: etag}}` returns only blocks whose ETag changed: `{server_time, etags, unchanged[], changed_blocks[], delta{}, transfer{...saving_pct}}`. A typical warm refresh transfers **0.02 kB — 10 blocks reused, 0 changed, 99.6 % saved**.
* **Offline-first repository.** `src/lib/api.ts` wraps every fetch in a repository that writes each block to an `EdgeDriver` with timestamps, then serves the last-known-good snapshot when the network drops. The UI shows a "cached data" banner with the age of the observation and keeps working across all tabs.
* **2G degradation.** The connectivity simulator (4G / 2G / offline) throttles requests; under 2G the client skips the hourly and satellite blocks and renders vector SVG icons only — no raster tiles, no web fonts re-fetch.
* **Vector-only rendering.** Every icon, radar cell, gauge, meter and chart is hand-written SVG (single sprite sheet, `icons.svg`) — there is no chart library and no bitmap asset in the bundle.

> **Storage note.** `EdgeDriver` is an injectable interface. In this browser prototype it is backed by an in-memory `Map` (the sandboxed preview iframe blocks `localStorage`/`indexedDB`). On device, swap the driver for **SQLite (`sqflite`) / Hive** in Flutter or `expo-sqlite` in React Native — the documented swap point is a single class in `src/lib/api.ts`; no call-site changes.

---

## 7. Module 4 — Bhashini multilingual voice assistant

* `app/services/bhashini.py` converts the full meteorological bulletin into a **2-line conversational script** in the requested language, always ordered *hazard first → action second* (e.g. "सावधान! आंधी-तूफ़ान की चेतावनी जारी है… अगली 24 घंटों में बारिश की संभावना 50 प्रतिशत है। अभी छिड़काव न करें").
* `GET /voice/bulletin` returns `{lines[], text, engine, speech_locale, language}` — the exact contract for the Bhashini ULCA TTS pipeline (`pipeline_id` + `serviceId` slots are documented in the module). Without Bhashini credentials the client plays the same text through **Web Speech `SpeechSynthesisUtterance`**, matching the locale.
* **14 languages:** Hindi, English, Bengali, Marathi, Telugu, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu (RTL), Nepali. Spoken bulletins are fully localised in all 14; the UI is fully translated for Hindi and English with a core-label set plus English fallback for the rest.
* Tapping **सुनें / Listen** speaks the bulletin and simultaneously shows the transcript card, so the feature is usable with sound off or on devices without a matching TTS voice.

---

## 8. Stack & parity notes

| Layer | This prototype | Production target |
| --- | --- | --- |
| Frontend | React 19 + TypeScript + Vite + Tailwind v3, mobile-first (390×844), phone-framed on desktop | Flutter (Dart) or React Native — the same component tree, tokens and persona contract map 1:1; only the render layer changes |
| Backend | FastAPI + Uvicorn, async routers, GZip middleware | unchanged |
| Cache | Redis 5-min TTL with in-memory fallback; client-side `EdgeDriver` | Redis cluster + SQLite/Hive on device |
| Data | Deterministic synthetic generators (hash-seeded by district/day/hour) mirroring **IMD Open Weather, CPCB AQI, ISRO MOSDAC and NDMA CAP** schemas | live IMD/CPCB/MOSDAC/NDMA feeds — swap the service modules, keep the routers |
| Voice | Bhashini contract + Web Speech fallback | Bhashini ULCA TTS |

**Why deterministic synthetic data:** IMD/CPCB/MOSDAC production feeds require MoES-issued keys. Every generator is seeded by district, date and hour, so demos are reproducible and reviewers see identical numbers — while the response schemas match the real APIs field-for-field, making the swap a service-layer change only.

---

## 9. Verification checklist

* All four personas render a non-empty, correctly ranked grid at Lucknow, Mumbai, Puri, Shimla and Delhi.
* Emergency override verified at Puri: the cyclone tracker is promoted to rank #1 for kisan, commuter and tourist alike.
* Dark and light themes, Hindi/English UI and Urdu RTL all pass with no text overflow.
* Nowcast timeline slider, Agromet bulletin, Sync/offline simulation and the widget reorder controls all exercised with zero console errors.
* Payload confirmed at 4.2 kB gzip (4.9 kB with an active cyclone); warm delta refresh at 22 B, 99.5 % saved.
* Location picker exercised end to end: district search ("goa" -> North Goa), no-match state, manual coordinates 11.0168/76.9558 -> Nilgiris with its orange landslide alert, out-of-range 99/12 rejected with a validation message, and a denied GPS permission handled with a readable notice.
