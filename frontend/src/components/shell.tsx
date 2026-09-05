import { useEffect, useRef, useState } from 'react';
import { LANGUAGES } from '../lib/i18n';
import { skyLabel } from '../lib/i18n';
import type { CapAlert, DistrictOption, HomePayload, Persona } from '../lib/types';
import { COLOUR_TOKEN, Icon, Logo, skyIcon } from './ui';

export const PERSONAS: { id: Persona; icon: Parameters<typeof Icon>[0]['name']; emoji: string }[] = [
  { id: 'kisan', icon: 'leaf', emoji: '🌾' },
  { id: 'commuter', icon: 'bus', emoji: '🚗' },
  { id: 'tourist', icon: 'bag', emoji: '🎒' },
  { id: 'coastal', icon: 'wave', emoji: '⚠️' },
];

/* ── Module 4: Bhashini / Web Speech voice controller ─────────────────── */

export function useVoice() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const ref = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => window.speechSynthesis?.cancel();
  }, []);

  const stop = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  /**
   * Speaks the two-line bulletin the backend composed. In production the same
   * text is POSTed to the Bhashini ULCA TTS pipeline and the returned audio is
   * played instead; the Web Speech engine is the offline / mock fallback.
   */
  const speak = (lines: string[], locale: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(lines.join(' '));
    u.lang = locale;
    u.rate = 0.92;
    u.pitch = 1;
    const match = window.speechSynthesis.getVoices().find((v) => v.lang === locale || v.lang.startsWith(locale.split('-')[0]));
    if (match) u.voice = match;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    ref.current = u;
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  return { speak, stop, speaking, supported };
}

/* ── Top bar ──────────────────────────────────────────────────────────── */

export function TopBar({
  p,
  persona,
  setPersona,
  lang,
  setLang,
  t,
  onSpeak,
  speaking,
  districts,
  onPickDistrict,
  onPickCoords,
  coordSource,
  theme,
  toggleTheme,
  net,
}: {
  p: HomePayload | null;
  persona: Persona;
  setPersona: (v: Persona) => void;
  lang: string;
  setLang: (v: string) => void;
  t: (k: string) => string;
  onSpeak: () => void;
  speaking: boolean;
  districts: DistrictOption[];
  onPickDistrict: (d: DistrictOption) => void;
  onPickCoords: (lat: number, lon: number, source: 'gps' | 'manual') => void;
  coordSource: 'district' | 'gps' | 'manual';
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  net: 'live' | 'stale';
}) {
  const [open, setOpen] = useState<'persona' | 'lang' | 'place' | null>(null);
  const close = () => setOpen(null);

  return (
    <header className="border-b border-line bg-bg">
      <div className="flex items-center gap-2 px-3.5 pb-2 pt-3">
        <span className="text-accent">
          <Logo size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight tracking-[-0.015em]">{t('appName')}</p>
          <p className="truncate text-[9.5px] leading-tight text-muted">{t('ministry')}</p>
        </div>
        <button onClick={toggleTheme} className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label={t('theme')}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
        </button>
        <button
          onClick={onSpeak}
          aria-label={speaking ? t('stop') : t('speak')}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
            speaking ? 'bg-danger text-white' : 'bg-accent text-white'
          }`}
        >
          <Icon name={speaking ? 'stop' : 'speaker'} size={14} />
          <span>{speaking ? t('stop') : t('speak')}</span>
        </button>
      </div>

      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-3.5 pb-2.5">
        <button onClick={() => setOpen(open === 'place' ? null : 'place')} className="chip max-w-[47%] shrink-0 text-ink">
          <Icon name="pin" size={13} className="shrink-0 text-accent" />
          <span className="truncate">{p ? p.location.district : '—'}</span>
          {coordSource !== 'district' && (
            <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide text-accent">
              {coordSource === 'gps' ? 'GPS' : t('manualBadge')}
            </span>
          )}
          <Icon name="chevron" size={11} className="shrink-0" />
        </button>
        <button onClick={() => setOpen(open === 'persona' ? null : 'persona')} className="chip shrink-0 text-ink">
          <span>{PERSONAS.find((x) => x.id === persona)?.emoji}</span>
          <span className="truncate">{t(persona)}</span>
          <Icon name="chevron" size={11} className="shrink-0" />
        </button>
        <button onClick={() => setOpen(open === 'lang' ? null : 'lang')} className="chip shrink-0 text-ink">
          <Icon name="globe" size={13} className="shrink-0" />
          <span>{LANGUAGES.find((l) => l.code === lang)?.native}</span>
          <Icon name="chevron" size={11} className="shrink-0" />
        </button>
        <span className={`chip shrink-0 ${net === 'stale' ? 'text-warn' : 'text-ok'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${net === 'stale' ? 'bg-warn' : 'bg-ok'}`} />
          {net === 'stale' ? t('offline') : t('online')}
        </span>
      </div>

      {open === 'persona' && (
        <Sheet onClose={close} title={t('persona')}>
          <div className="grid grid-cols-2 gap-2">
            {PERSONAS.map((x) => (
              <button
                key={x.id}
                onClick={() => {
                  setPersona(x.id);
                  close();
                }}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-[12.5px] font-semibold transition-colors ${
                  persona === x.id ? 'border-accent bg-accent/12 text-accent' : 'border-line bg-raised text-ink'
                }`}
              >
                <span className="text-base">{x.emoji}</span>
                <span className="min-w-0 truncate">{t(`${x.id}Full`)}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {open === 'lang' && (
        <Sheet onClose={close} title={t('language')}>
          <div className="grid grid-cols-3 gap-1.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLang(l.code);
                  close();
                }}
                className={`rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  lang === l.code ? 'border-accent bg-accent/12 text-accent' : 'border-line bg-raised text-ink'
                }`}
              >
                {l.native}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] leading-snug text-muted">
            Spoken bulletins are composed in all 14 languages by the backend Bhashini pipeline.
          </p>
        </Sheet>
      )}

      {open === 'place' && (
        <Sheet onClose={close} title={t('changeLocation')}>
          <LocationPicker
            t={t}
            districts={districts}
            activeDistrict={p ? p.location.district : ''}
            coordSource={coordSource}
            onPickDistrict={(d) => {
              onPickDistrict(d);
              close();
            }}
            onPickCoords={(lat, lon, src) => {
              onPickCoords(lat, lon, src);
              close();
            }}
          />
        </Sheet>
      )}

    </header>
  );
}

/* ── Location picker: search · GPS · manual coordinates ──────────────── */

const IN_BOUNDS = { latMin: 6, latMax: 38, lonMin: 68, lonMax: 98 };
const inIndia = (lat: number, lon: number) =>
  lat >= IN_BOUNDS.latMin && lat <= IN_BOUNDS.latMax && lon >= IN_BOUNDS.lonMin && lon <= IN_BOUNDS.lonMax;

function LocationPicker({
  t,
  districts,
  activeDistrict,
  coordSource,
  onPickDistrict,
  onPickCoords,
}: {
  t: (k: string) => string;
  districts: DistrictOption[];
  activeDistrict: string;
  coordSource: 'district' | 'gps' | 'manual';
  onPickDistrict: (d: DistrictOption) => void;
  onPickCoords: (lat: number, lon: number, source: 'gps' | 'manual') => void;
}) {
  const [q, setQ] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'warn' | 'ok'; text: string } | null>(null);

  const needle = q.trim().toLowerCase();
  const list = needle
    ? districts.filter(
        (d) =>
          d.district.toLowerCase().includes(needle) ||
          d.state.toLowerCase().includes(needle) ||
          (d.agro_zone ?? '').toLowerCase().includes(needle),
      )
    : districts;

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setMsg({ tone: 'warn', text: t('gpsUnavailable') });
      return;
    }
    setBusy(true);
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const la = Number(pos.coords.latitude.toFixed(4));
        const lo = Number(pos.coords.longitude.toFixed(4));
        if (!inIndia(la, lo)) setMsg({ tone: 'warn', text: t('gpsOutside') });
        onPickCoords(la, lo, 'gps');
      },
      () => {
        setBusy(false);
        setMsg({ tone: 'warn', text: t('gpsDenied') });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const applyManual = () => {
    const la = Number(lat);
    const lo = Number(lon);
    if (!lat.trim() || !lon.trim() || Number.isNaN(la) || Number.isNaN(lo) || !inIndia(la, lo)) {
      setMsg({ tone: 'warn', text: t('badCoords') });
      return;
    }
    onPickCoords(Number(la.toFixed(4)), Number(lo.toFixed(4)), 'manual');
  };

  return (
    <div className="space-y-2.5">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-raised px-2.5 py-2">
        <Icon name="pin" size={13} className="shrink-0 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchDistrict')}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-muted"
        />
        {q && (
          <button onClick={() => setQ('')} className="shrink-0 text-[11px] font-semibold text-accent">
            ×
          </button>
        )}
      </label>

      <button
        onClick={locate}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
      >
        <Icon name="pin" size={14} />
        <span>{busy ? t('locating') : t('useMyLocation')}</span>
      </button>

      {msg && (
        <p className={`text-[10.5px] leading-snug ${msg.tone === 'warn' ? 'text-warn' : 'text-ok'}`}>{msg.text}</p>
      )}

      <div className="scroll-thin max-h-[34vh] space-y-1 overflow-y-auto pr-1">
        {list.length === 0 && <p className="px-2 py-3 text-[11.5px] text-muted">{t('noMatch')}</p>}
        {list.map((d) => {
          const active = coordSource === 'district' && d.district === activeDistrict;
          return (
            <button
              key={d.id}
              onClick={() => onPickDistrict(d)}
              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${
                active ? 'border-accent bg-accent/12' : 'border-transparent hover:bg-raised'
              }`}
            >
              <Icon name="pin" size={13} className={`shrink-0 ${active ? 'text-accent' : 'text-muted'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[12.5px] font-medium ${active ? 'text-accent' : 'text-ink'}`}>
                  {d.district}
                </span>
                <span className="block truncate text-[10px] text-muted">
                  {d.state} · {d.terrain}
                </span>
              </span>
              <span className="shrink-0 text-[9.5px] tabular-nums text-muted">
                {d.lat.toFixed(2)}, {d.lon.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-line bg-raised p-2.5">
        <p className="label mb-1.5">{t('manualCoords')}</p>
        <div className="flex items-end gap-1.5">
          <span className="min-w-0 flex-1">
            <span className="mb-1 block text-[9.5px] text-muted">{t('latitude')}</span>
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              inputMode="decimal"
              placeholder="26.8467"
              className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] tabular-nums text-ink outline-none placeholder:text-faint"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="mb-1 block text-[9.5px] text-muted">{t('longitude')}</span>
            <input
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              inputMode="decimal"
              placeholder="80.9462"
              className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] tabular-nums text-ink outline-none placeholder:text-faint"
            />
          </span>
          <button
            onClick={applyManual}
            className="shrink-0 rounded-lg border border-accent px-2.5 py-1.5 text-[12px] font-semibold text-accent"
          >
            {t('setCoords')}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted">{t('snapNote')}</p>
      </div>
    </div>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-20 bg-black/35" onClick={onClose} />
      <div className="absolute inset-x-0 top-full z-30 mx-2 rounded-2xl border border-line bg-surface p-3 shadow-lift animate-fade-up">
        <div className="mb-2 flex items-center justify-between">
          <p className="label">{title}</p>
          <button onClick={onClose} className="text-[11px] font-semibold text-accent">
            Close
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

/* ── Emergency banner (universal override) ───────────────────────────── */

export function EmergencyBanner({ alert, lang, t }: { alert: CapAlert; lang: string; t: (k: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const token = COLOUR_TOKEN[alert.colour] ?? 'danger';
  const headline = lang === 'hi' && alert.headline_hi ? alert.headline_hi : alert.headline;
  const instruction = lang === 'hi' && alert.instruction_hi ? alert.instruction_hi : alert.instruction;
  return (
    <div className={`border-b border-${token}/40 bg-bg`}>
      <div className={`bg-${token}/15 px-3.5 py-2.5`}>
      <button className="flex w-full items-start gap-2.5 text-left" onClick={() => setExpanded((v) => !v)}>
        <span className={`mt-0.5 shrink-0 text-${token}`}>
          <Icon name="alert" size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.1em] text-${token}`}>
            {alert.colour} · {alert.event} · {alert.source}
          </p>
          <p className={`mt-0.5 text-[12.5px] font-semibold leading-snug ${expanded ? '' : 'line-clamp-2'}`}>{headline}</p>
        </div>
        <Icon name="chevron" size={14} className={`mt-1 shrink-0 text-${token} ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-line/60 pt-2">
          <p className="text-[12px] leading-snug text-muted">{alert.description}</p>
          <p className="label">{t('instruction')}</p>
          <p className="text-[12px] font-medium leading-snug">{instruction}</p>
          <p className="text-[10px] text-muted">
            CAP {alert.identifier} · {alert.urgency}/{alert.severity}/{alert.certainty} · expires{' '}
            {new Date(alert.expires).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
          </p>
        </div>
      )}
      </div>
    </div>
  );
}

/** Non-override warnings (yellow / orange) still need to be seen on the homepage. */
export function AlertStrip({ alerts, lang }: { alerts: CapAlert[]; lang: string }) {
  const [i, setI] = useState(0);
  if (!alerts.length) return null;
  const a = alerts[Math.min(i, alerts.length - 1)];
  const token = COLOUR_TOKEN[a.colour] ?? 'caution';
  const headline = lang === 'hi' && a.headline_hi ? a.headline_hi : a.headline;
  return (
    <div className={`rounded-xl border border-${token}/40 bg-${token}/10 px-3 py-2`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 text-${token}`}>
          <Icon name="alert" size={15} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[9.5px] font-bold uppercase tracking-[0.1em] text-${token}`}>
            {a.colour} · {a.event}
          </p>
          <p className="mt-0.5 text-[11.5px] font-medium leading-snug">{headline}</p>
        </div>
        {alerts.length > 1 ? (
          <button
            onClick={() => setI((v) => (v + 1) % alerts.length)}
            className={`shrink-0 rounded-full border border-${token}/40 px-1.5 py-0.5 text-[10px] font-bold text-${token}`}
          >
            {Math.min(i, alerts.length - 1) + 1}/{alerts.length}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── Hero card ───────────────────────────────────────────────────────── */

export function HeroCard({ p, lang, t }: { p: HomePayload; lang: string; t: (k: string) => string }) {
  const o = p.observation;
  const aqiTone = p.air_quality.aqi <= 50 ? 'ok' : p.air_quality.aqi <= 100 ? 'crop' : p.air_quality.aqi <= 200 ? 'caution' : 'danger';
  return (
    <section className="card overflow-hidden">
      <div className="flex items-start gap-3 p-3.5 pb-3">
        <div className="min-w-0 flex-1">
          <p className="metric text-[42px] font-bold leading-none tracking-[-0.03em]">
            {Math.round(o.temp_c)}
            <span className="align-top text-lg font-semibold text-muted">°C</span>
          </p>
          <p className="mt-1 truncate text-[13px] font-semibold">{skyLabel(o.sky_code, lang)}</p>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {t('feelsLike')} {Math.round(o.feels_like_c)}° · {Math.round(o.temp_max_c)}° / {Math.round(o.temp_min_c)}°
            {o.departure_from_normal_c !== 0 ? ` · ${o.departure_from_normal_c > 0 ? '+' : ''}${o.departure_from_normal_c}° vs normal` : ''}
          </p>
        </div>
        <span className="shrink-0 text-rain">
          <Icon name={skyIcon(o.sky_code)} size={52} strokeWidth={1.3} />
        </span>
      </div>
      <div className="grid grid-cols-4 divide-x divide-line border-t border-line">
        {[
          { label: t('humidity'), value: `${o.humidity_pct}%`, tone: 'ink' },
          { label: t('wind'), value: `${Math.round(o.wind_kmph)}`, unit: `km/h ${o.wind_dir}`, tone: 'ink' },
          { label: t('aqi'), value: `${p.air_quality.aqi}`, tone: aqiTone },
          { label: t('uv'), value: `${o.uv_index}`, tone: o.uv_index >= 8 ? 'danger' : o.uv_index >= 6 ? 'warn' : 'ok' },
        ].map((s) => (
          <div key={s.label} className="min-w-0 px-2 py-2">
            <div className="label truncate">{s.label}</div>
            <div className={`metric mt-0.5 truncate text-[14px] font-bold text-${s.tone}`}>{s.value}</div>
            {s.unit ? <div className="truncate text-[9.5px] text-muted">{s.unit}</div> : null}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3.5 py-2 text-[10.5px] text-muted">
        <span className="truncate">
          IMD {o.station} · {t('rain24')} {o.rain_last_24h_mm} mm · {t('rainChance')} {o.rain_prob_24h_pct}%
        </span>
        <span className="metric shrink-0">
          ↑{o.sunrise} ↓{o.sunset}
        </span>
      </div>
    </section>
  );
}

/* ── Bottom navigation ───────────────────────────────────────────────── */

export type Tab = 'home' | 'radar' | 'agromet' | 'settings';

export function BottomNav({ tab, setTab, t, badge }: { tab: Tab; setTab: (t: Tab) => void; t: (k: string) => string; badge: boolean }) {
  const items: { id: Tab; icon: Parameters<typeof Icon>[0]['name'] }[] = [
    { id: 'home', icon: 'home' },
    { id: 'radar', icon: 'radar' },
    { id: 'agromet', icon: 'leaf' },
    { id: 'settings', icon: 'sync' },
  ];
  return (
    <nav className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-line bg-bg/95 pb-1 backdrop-blur-md">
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setTab(it.id)}
            className={`relative flex flex-col items-center gap-0.5 py-2 transition-colors ${active ? 'text-accent' : 'text-muted'}`}
          >
            <Icon name={it.icon} size={19} strokeWidth={active ? 2.1 : 1.7} />
            <span className="text-[10px] font-semibold">{t(it.id)}</span>
            {it.id === 'settings' && badge ? (
              <span className="absolute right-[26%] top-1.5 h-1.5 w-1.5 rounded-full bg-warn" />
            ) : null}
            {active ? <span className="absolute inset-x-[28%] top-0 h-[2px] rounded-full bg-accent" /> : null}
          </button>
        );
      })}
    </nav>
  );
}
