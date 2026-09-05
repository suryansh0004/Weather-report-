import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchDistricts,
  fetchNowcast,
  readHomepage,
  type HomeResult,
  type NetProfile,
} from './lib/api';
import { LANGUAGES, makeT } from './lib/i18n';
import type { DistrictOption, Nowcast, Persona } from './lib/types';
import { AlertStrip, BottomNav, EmergencyBanner, HeroCard, PERSONAS, TopBar, useVoice, type Tab } from './components/shell';
import { Card, Icon } from './components/ui';
import { ErrorBoundary } from './components/boundary';
import { WidgetGrid, isRenderable } from './components/widgets';
import { AgrometScreen, NowcastScreen, SyncScreen } from './screens';

const DEFAULT_PLACES: Record<Persona, { lat: number; lon: number }> = {
  kisan: { lat: 26.8467, lon: 80.9462 },
  commuter: { lat: 19.076, lon: 72.8777 },
  tourist: { lat: 31.1048, lon: 77.1734 },
  coastal: { lat: 19.8135, lon: 85.8312 },
};

export default function App() {
  const [persona, setPersona] = useState<Persona>('kisan');
  const [lang, setLang] = useState('hi');
  const [coords, setCoords] = useState(DEFAULT_PLACES.kisan);
  const [coordSource, setCoordSource] = useState<'district' | 'gps' | 'manual'>('district');
  const [net, setNet] = useState<NetProfile>('4g');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [tab, setTab] = useState<Tab>('home');
  const mainRef = useRef<HTMLElement | null>(null);
  const [bulletinOpen, setBulletinOpen] = useState(false);

  /** On a handset the window scrolls; inside the desktop phone frame <main> does. */
  const scrollTop = (behavior: ScrollBehavior) => {
    mainRef.current?.scrollTo({ top: 0, behavior });
    window.scrollTo({ top: 0, behavior });
  };

  const [result, setResult] = useState<HomeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowcast, setNowcast] = useState<Nowcast | null>(null);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [showWhy, setShowWhy] = useState(false);
  const [manualOrder, setManualOrder] = useState(false);

  const t = useMemo(() => makeT(lang), [lang]);
  const voice = useVoice();
  const reqId = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
  }, [theme, lang]);

  useEffect(() => {
    fetchDistricts()
      .then(setDistricts)
      .catch(() => setDistricts([]));
  }, []);

  const query = useMemo(
    () => ({ lat: coords.lat, lon: coords.lon, persona, lang }),
    [coords.lat, coords.lon, persona, lang],
  );

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await readHomepage(query, net);
      if (id !== reqId.current) return;
      setResult(res);
      if (!manualOrder) {
        setOrder(
          res.payload.layout.widgets
            .filter((w) => w.id !== 'hero' && w.id !== 'emergency' && isRenderable(w.id, res.payload))
            .map((w) => w.id),
        );
      }
    } catch (e: any) {
      if (id !== reqId.current) return;
      setError(e?.message === 'offline-no-cache' ? 'no-cache' : String(e?.message ?? e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [query, net, manualOrder]);

  useEffect(() => {
    void load();
  }, [load]);

  // Persona / place change resets the operator-tuned order back to the engine ranking.
  useEffect(() => {
    setManualOrder(false);
    scrollTop('smooth');
  }, [persona, coords.lat, coords.lon]);

  useEffect(() => {
    scrollTop('auto');
  }, [tab]);

  useEffect(() => {
    if (net === 'offline') return;
    let live = true;
    fetchNowcast(coords.lat, coords.lon, net)
      .then((n) => live && setNowcast(n))
      .catch(() => live && setNowcast(null));
    return () => {
      live = false;
    };
  }, [coords.lat, coords.lon, net]);

  const p = result?.payload ?? null;
  const topAlert = p?.alerts?.[0];
  const emergency = Boolean(p?.layout.emergency_override && topAlert);

  const onSpeak = () => {
    if (voice.speaking) {
      voice.stop();
      return;
    }
    setBulletinOpen(true);
    if (p) voice.speak(p.voice.lines, p.voice.speech_locale || LANGUAGES.find((l) => l.code === lang)?.locale || 'hi-IN');
  };

  const gridWidgets = p
    ? p.layout.widgets.filter((w) => w.id !== 'hero' && w.id !== 'emergency' && isRenderable(w.id, p))
    : [];

  return (
    <div className="min-h-full bg-black/0 md:flex md:items-center md:justify-center md:bg-bg md:py-6">
      {/* Phone frame on desktop, full-bleed on a handset */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-bg md:min-h-[860px] md:max-h-[860px] md:overflow-hidden md:rounded-[30px] md:border md:border-line md:shadow-lift">
        <div className="sticky top-0 z-30">
        <TopBar
          p={p}
          persona={persona}
          setPersona={setPersona}
          lang={lang}
          setLang={setLang}
          t={t}
          onSpeak={onSpeak}
          speaking={voice.speaking}
          districts={districts}
          onPickDistrict={(d) => {
            setCoords({ lat: d.lat, lon: d.lon });
            setCoordSource('district');
          }}
          onPickCoords={(lat, lon, source) => {
            setCoords({ lat, lon });
            setCoordSource(source);
          }}
          coordSource={coordSource}
          theme={theme}
          toggleTheme={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))}
          net={result?.stale ? 'stale' : 'live'}
        />

        {emergency && topAlert ? <EmergencyBanner alert={topAlert} lang={lang} t={t} /> : null}
        </div>

        <main ref={mainRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto px-3.5 pb-6 pt-3">
          <ErrorBoundary key={`${tab}:${persona}:${coords.lat}`}>
          {result?.stale ? (
            <div className="flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2">
              <Icon name="offline" size={16} className="shrink-0 text-warn" />
              <p className="min-w-0 text-[11.5px] leading-snug text-warn">
                {t('cachedData')} · {result.ageMinutes === 0 ? t('justNow') : `${result.ageMinutes} ${t('minAgo')}`}
              </p>
            </div>
          ) : null}

          {error === 'no-cache' ? (
            <Card>
              <p className="text-[12.5px] font-semibold">Nothing cached for this district yet</p>
              <p className="mt-1 text-[11.5px] leading-snug text-muted">
                Switch back to 4G or 2G once so the edge cache can store a bulletin, then offline mode will serve it.
              </p>
              <button onClick={() => setNet('4g')} className="btn mt-2.5 w-full">
                Go online
              </button>
            </Card>
          ) : error ? (
            <Card>
              <p className="text-[12.5px] font-semibold text-danger">Could not reach the Mausam API</p>
              <p className="mt-1 break-words text-[11px] text-muted">{error}</p>
              <button onClick={() => void load()} className="btn mt-2.5 w-full">
                <Icon name="refresh" size={14} />
                {t('retry')}
              </button>
            </Card>
          ) : null}

          {loading && !p ? <Skeletons /> : null}

          {p && tab === 'home' ? (
            <>
              {!emergency && p.alerts.length ? <AlertStrip alerts={p.alerts} lang={lang} /> : null}

              {bulletinOpen ? (
                <Card className="border-accent/40">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-accent">
                      <Icon name="speaker" size={15} />
                    </span>
                    <p className="label flex-1">{p.voice.engine}</p>
                    <button
                      onClick={() => {
                        voice.stop();
                        setBulletinOpen(false);
                      }}
                      className="text-[11px] font-semibold text-muted hover:text-ink"
                    >
                      ✕
                    </button>
                  </div>
                  {p.voice.lines.map((line, i) => (
                    <p key={i} className="text-[12.5px] leading-relaxed">
                      {line}
                    </p>
                  ))}
                  {!voice.supported ? (
                    <p className="mt-1.5 text-[11px] text-muted">
                      Speech synthesis is unavailable in this browser — on device the same text is played through the
                      Bhashini TTS pipeline.
                    </p>
                  ) : null}
                </Card>
              ) : null}

              <HeroCard p={p} lang={lang} t={t} />

              <div className="flex items-center justify-between gap-2 px-0.5">
                <p className="text-[10.5px] leading-snug text-muted">{t('reorderHint')}</p>
                <button
                  onClick={() => setShowWhy((v) => !v)}
                  className={`shrink-0 rounded-full border px-2 py-1 text-[10.5px] font-semibold transition-colors ${
                    showWhy ? 'border-accent bg-accent/12 text-accent' : 'border-line text-muted'
                  }`}
                >
                  {t('whyThisOrder')}
                </button>
              </div>

              {showWhy ? (
                <div className="rounded-xl border border-dashed border-accent/40 bg-accent/10 px-3 py-2">
                  <p className="text-[11px] leading-snug">
                    <span className="font-semibold">Persona engine:</span> {t(persona)} weights ×{' '}
                    {p.layout.signals.alerts_active} active alert(s), severity {p.layout.severity_score}/100
                    {p.layout.emergency_override ? ' · emergency override engaged' : ''} · nowcast{' '}
                    {String(p.layout.signals.nowcast_band).replace('_', ' ')} · AQI {p.layout.signals.aqi} · soil{' '}
                    {p.layout.signals.soil_moisture_pct}%
                  </p>
                </div>
              ) : null}

              <WidgetGrid
                widgets={gridWidgets}
                ctx={{ p, lang, t }}
                order={order.length ? order : gridWidgets.map((w) => w.id)}
                onReorder={(next) => {
                  setManualOrder(true);
                  setOrder(next);
                }}
                showWhy={showWhy}
              />

              <PersonaSwitcher persona={persona} setPersona={setPersona} t={t} />

              <p className="px-1 pt-1 text-center text-[10px] leading-snug text-muted">
                {p.meta.source} · {p.meta.mode} mode · issued{' '}
                {new Date(p.issued_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST ·{' '}
                {(result?.bytes ?? 0) / 1024 > 0 ? `${((result?.bytes ?? 0) / 1024).toFixed(1)} kB gzip` : 'from cache'}
              </p>
            </>
          ) : null}

          {p && tab === 'radar' ? <NowcastScreen nowcast={nowcast ?? p.persona_data?.nowcast ?? null} p={p} t={t} /> : null}
          {p && tab === 'agromet' ? <AgrometScreen p={p} t={t} /> : null}
          {p && tab === 'settings' ? (
            <SyncScreen
              result={result}
              net={net}
              setNet={setNet}
              onRefresh={() => void load()}
              query={query}
              t={t}
              lang={LANGUAGES.find((l) => l.code === lang)?.native ?? lang}
              voiceText={p.voice.text}
            />
          ) : null}
          </ErrorBoundary>
        </main>

        <BottomNav tab={tab} setTab={setTab} t={t} badge={net !== '4g'} />
      </div>
    </div>
  );
}

function PersonaSwitcher({ persona, setPersona, t }: { persona: Persona; setPersona: (p: Persona) => void; t: (k: string) => string }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 pt-1">
      {PERSONAS.map((x) => (
        <button
          key={x.id}
          onClick={() => setPersona(x.id)}
          className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors ${
            persona === x.id ? 'border-accent bg-accent/12 text-accent' : 'border-line bg-surface text-muted'
          }`}
        >
          <span className="text-[15px] leading-none">{x.emoji}</span>
          <span className="w-full truncate text-center text-[10px] font-semibold">{t(x.id)}</span>
        </button>
      ))}
    </div>
  );
}

function Skeletons() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card p-3.5">
          <div className="animate-pulse space-y-2.5">
            <div className="h-3 w-1/3 rounded bg-line" />
            <div className="h-8 w-2/3 rounded bg-line" />
            <div className="h-2.5 w-full rounded bg-line" />
            <div className="h-2.5 w-4/5 rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}
