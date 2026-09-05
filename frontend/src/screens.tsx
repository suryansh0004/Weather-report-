import { useEffect, useMemo, useState } from 'react';
import { BarSeries, Card, Gauge, Icon, Meter, Sparkline } from './components/ui';
import { driver, fetchAgromet, fetchPayloadReport, transferLog, type HomeResult, type NetProfile } from './lib/api';
import type { HomePayload, Nowcast } from './lib/types';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

/* ── Nowcast radar screen ─────────────────────────────────────────────── */

export function NowcastScreen({ nowcast, p, t }: { nowcast: Nowcast | null; p: HomePayload; t: (k: string) => string }) {
  const [minute, setMinute] = useState(0);

  if (!nowcast || !nowcast.steps?.length) {
    return (
      <Card>
        <p className="text-[12.5px] text-muted">Radar nowcast is not available for this station right now.</p>
      </Card>
    );
  }

  const step =
    nowcast.steps.reduce((best, s) => (Math.abs(s.offset_min - minute) < Math.abs(best.offset_min - minute) ? s : best), nowcast.steps[0]);

  // Convection cell drifts across the radar frame as the timeline advances.
  const drift = minute / 60;
  const cx = 90 + drift * 90;
  const cy = 118 - drift * 46;
  const cellR = 14 + step.intensity_mmph * 3.4;
  const intensityTone =
    step.intensity_mmph >= 6 ? 'danger' : step.intensity_mmph >= 2.5 ? 'warn' : step.intensity_mmph >= 0.4 ? 'rain' : 'muted';

  const headline = nowcast.in_progress
    ? 'Rain in progress'
    : nowcast.onset_in_min == null
      ? 'No rain in the next 60 minutes'
      : `Rain starting in about ${nowcast.onset_in_min} minutes`;

  return (
    <div className="stagger space-y-3">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold tracking-[-0.01em]">{headline}</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              {nowcast.radar_station} · DWR composite · issued {fmtTime(nowcast.issued_at)} IST
            </p>
          </div>
          <span className={`shrink-0 rounded-full bg-${intensityTone}/12 px-2 py-1 text-[10.5px] font-bold text-${intensityTone}`}>
            {nowcast.band.replace('_', ' ')}
          </span>
        </div>

        <svg viewBox="0 0 280 170" className="mt-3 w-full rounded-xl bg-raised" style={{ height: 176 }} aria-label="Rain radar">
          {[26, 52, 78].map((r) => (
            <circle key={r} cx="140" cy="88" r={r} fill="none" className="stroke-line" strokeWidth="1" strokeDasharray="3 4" />
          ))}
          <path d="M140 6v164M58 88h164" className="stroke-line" strokeWidth="1" strokeDasharray="3 4" />
          {[26, 52, 78].map((r, i) => (
            <text key={r} x="142" y={88 - r + 9} className="fill-muted" style={{ fontSize: 7.5 }}>
              {(i + 1) * 25} km
            </text>
          ))}
          {/* the gradient lives inside the tinted group so `currentColor` picks up the intensity tone */}
          <g className={`text-${intensityTone}`}>
            <defs>
              <radialGradient id="cell" cx="50%" cy="50%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
              </radialGradient>
            </defs>
            <ellipse cx={cx} cy={cy} rx={cellR * 1.5} ry={cellR} fill="url(#cell)" />
          </g>
          <circle cx="140" cy="88" r="4" className="fill-accent" />
          <circle cx="140" cy="88" r="12" className="fill-accent animate-ring" opacity="0.35" />
          <text x="148" y="91" className="fill-ink font-semibold" style={{ fontSize: 9 }}>
            {p.location.district}
          </text>
          <text x="10" y="163" className="fill-muted" style={{ fontSize: 7.5 }}>
            T+{step.offset_min} min · {step.intensity_mmph} mm/h · {step.prob_pct}% · cell {nowcast.cell_movement}
          </text>
        </svg>

        <input
          type="range"
          min={0}
          max={60}
          step={5}
          value={minute}
          onChange={(e) => setMinute(Number(e.target.value))}
          className="mt-3 w-full accent-accent"
          aria-label="Nowcast timeline minutes"
        />
        <div className="flex justify-between text-[10px] text-muted">
          <span>now</span>
          <span>+15</span>
          <span>+30</span>
          <span>+45</span>
          <span>+60 min</span>
        </div>
      </Card>

      <Card>
        <p className="label mb-2">Rain intensity (mm/h)</p>
        <BarSeries
          items={nowcast.steps.map((s) => ({ label: `${s.offset_min}`, value: Math.round(s.intensity_mmph * 10) / 10 }))}
          height={58}
          colour="rain"
        />
        <p className="label mb-1 mt-3">Probability of rain (%)</p>
        <Sparkline values={nowcast.steps.map((s) => s.prob_pct)} stroke="accent" height={34} />
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-2.5">
          <div>
            <div className="label">Peak</div>
            <div className="metric text-[13px] font-semibold">{nowcast.peak_intensity_mmph} mm/h</div>
          </div>
          <div>
            <div className="label">Peak at</div>
            <div className="metric text-[13px] font-semibold">+{nowcast.peak_in_min} min</div>
          </div>
          <div>
            <div className="label">Echo top</div>
            <div className="metric text-[13px] font-semibold">{nowcast.echo_top_km} km</div>
          </div>
        </div>
      </Card>

      <Card>
        <p className="label mb-2">{t('hourly24')}</p>
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1">
          {p.hourly.slice(0, 24).map((h) => (
            <div key={h.time} className="w-[42px] shrink-0 text-center">
              <div className="text-[10px] text-muted">{h.hour}</div>
              <div className="metric mt-1 text-[12px] font-semibold">{Math.round(h.temp_c)}°</div>
              <div className="metric text-[10px] text-rain">{h.rain_prob_pct}%</div>
              <div className="metric text-[9.5px] text-muted">{h.rain_mm}mm</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ── Agromet screen (full GKMS bulletin) ─────────────────────────────── */

export function AgrometScreen({ p, t }: { p: HomePayload; t: (k: string) => string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    fetchAgromet(p.location.district)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [p.location.district]);

  if (error)
    return (
      <Card>
        <p className="text-[12.5px] text-danger">Agromet bulletin unavailable ({error}).</p>
      </Card>
    );
  if (!data)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <div className="animate-pulse space-y-2">
              <div className="h-3 w-1/3 rounded bg-line" />
              <div className="h-2.5 w-full rounded bg-line" />
              <div className="h-2.5 w-4/5 rounded bg-line" />
            </div>
          </Card>
        ))}
      </div>
    );

  const b = data.bulletin;
  return (
    <div className="stagger space-y-3">
      <Card>
        <h2 className="text-[14px] font-bold tracking-[-0.01em]">Gramin Krishi Mausam Sewa</h2>
        <p className="mt-1 text-[11.5px] leading-snug text-muted">{b.issuing_authority}</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div>
            <div className="label">District</div>
            <div className="text-[12.5px] font-semibold">{b.district}</div>
          </div>
          <div>
            <div className="label">Season</div>
            <div className="text-[12.5px] font-semibold">{b.season}</div>
          </div>
          <div>
            <div className="label">Agro-climatic zone</div>
            <div className="text-[12.5px] font-semibold leading-snug">{b.agro_climatic_zone}</div>
          </div>
          <div>
            <div className="label">Valid till</div>
            <div className="metric text-[12.5px] font-semibold">{b.valid_till}</div>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
          {b.crops_in_field.map((c: string) => (
            <span key={c} className="rounded-lg bg-crop/12 px-2 py-1 text-[11px] font-medium text-crop">
              {c}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <p className="label mb-2">Crop advisories</p>
        <div className="space-y-2.5">
          {b.advisories.map((a: any, i: number) => (
            <div key={i} className="rounded-xl border border-line bg-raised p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[12.5px] font-semibold">
                  {a.crop} · <span className="font-normal text-muted">{a.stage}</span>
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    a.priority === 'high' ? 'bg-danger/12 text-danger' : 'bg-caution/12 text-caution'
                  }`}
                >
                  {a.priority}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-muted">{a.text}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        <Card>
          <p className="label mb-2">Spraying suitability</p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-[13.5px] font-bold text-${data.spraying.suitable ? 'ok' : 'danger'}`}>
                {data.spraying.verdict}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Window {data.spraying.window_start}–{data.spraying.window_end} IST
              </p>
            </div>
            <Gauge value={data.spraying.score} label="score" colour={data.spraying.suitable ? 'ok' : 'danger'} size={78} />
          </div>
          <div className="mt-2">
            <Sparkline values={data.spraying.timeline.map((x: any) => x.score)} stroke="crop" height={30} />
          </div>
        </Card>

        <Card>
          <p className="label mb-2">{t('soilMoisture')} · 7-day</p>
          <BarSeries
            items={data.soil_trend.map((d: any) => ({ label: d.day_label, value: d.moisture_pct }))}
            height={52}
            colour="soil"
            unit="%"
          />
        </Card>

        <Card>
          <p className="label mb-2">Sowing window</p>
          <div className="flex items-start gap-3">
            <Gauge value={data.sowing.score} label={data.sowing.season} colour="crop" size={82} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">{data.sowing.band}</p>
              <ul className="mt-1 space-y-1">
                {data.sowing.notes.map((n: string, i: number) => (
                  <li key={i} className="text-[11.5px] leading-snug text-muted">
                    • {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card>
          <p className="label mb-2">Irrigation & livestock</p>
          <p className="text-[12px] leading-snug">{data.irrigation.recommendation}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-2">
            <div>
              <div className="label">Need</div>
              <div className="metric text-[12.5px] font-semibold">{data.irrigation.irrigation_need_mm} mm</div>
            </div>
            <div>
              <div className="label">ET₀</div>
              <div className="metric text-[12.5px] font-semibold">{data.irrigation.reference_et0_mm_day}</div>
            </div>
            <div>
              <div className="label">Soil</div>
              <div className="metric text-[12.5px] font-semibold">{data.irrigation.soil_moisture_pct}%</div>
            </div>
          </div>
          <p className="mt-2 text-[11.5px] leading-snug text-muted">{b.livestock}</p>
          <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{b.horticulture}</p>
        </Card>
      </div>
    </div>
  );
}

/* ── Sync / offline settings screen ──────────────────────────────────── */

export function SyncScreen({
  result,
  net,
  setNet,
  onRefresh,
  query,
  t,
  lang,
  voiceText,
}: {
  result: HomeResult | null;
  net: NetProfile;
  setNet: (n: NetProfile) => void;
  onRefresh: () => void;
  query: { lat: number; lon: number; persona: string; lang: string };
  t: (k: string) => string;
  lang: string;
  voiceText: string;
}) {
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    if (net === 'offline') return;
    fetchPayloadReport(query)
      .then(setReport)
      .catch(() => setReport(null));
  }, [query.lat, query.lon, query.persona, query.lang, net]);

  const blocks = useMemo(
    () => (report ? Object.entries(report.blocks).sort((a: any, b: any) => b[1].gzip_bytes - a[1].gzip_bytes) : []),
    [report],
  );

  return (
    <div className="stagger space-y-3">
      <Card>
        <p className="label mb-2">Connectivity simulation</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(['4g', '2g', 'offline'] as NetProfile[]).map((n) => (
            <button
              key={n}
              onClick={() => setNet(n)}
              className={`rounded-xl border px-2 py-2 text-[12px] font-semibold transition-colors ${
                net === n ? 'border-accent bg-accent/12 text-accent' : 'border-line bg-raised text-ink'
              }`}
            >
              {n === '4g' ? '4G / Wi-Fi' : n === '2g' ? '2G edge' : t('offline')}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted">
          2G throttles the client to ~14 kB/s so the delta-sync saving is observable; offline forces reads out of the edge
          cache with no network at all.
        </p>
        <button onClick={onRefresh} className="btn btn-accent mt-2.5 w-full">
          <Icon name="refresh" size={15} />
          {t('syncNow')}
        </button>
      </Card>

      <Card>
        <p className="label mb-2">Last read</p>
        {result ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="label">Source</div>
                <div className="text-[12.5px] font-semibold">
                  {result.source === 'cache' ? 'Edge cache' : result.source === 'network-delta' ? 'Delta sync' : 'Full fetch'}
                </div>
              </div>
              <div>
                <div className="label">Transferred</div>
                <div className="metric text-[12.5px] font-semibold">{(result.bytes / 1024).toFixed(2)} kB gzip</div>
              </div>
              <div>
                <div className="label">Round trip</div>
                <div className="metric text-[12.5px] font-semibold">{result.ms} ms</div>
              </div>
              <div>
                <div className="label">{t('lastUpdated')}</div>
                <div className="metric text-[12.5px] font-semibold">
                  {result.ageMinutes === 0 ? t('justNow') : `${result.ageMinutes} ${t('minAgo')}`}
                </div>
              </div>
            </div>
            {result.sync ? (
              <div className="mt-2.5 rounded-xl border border-line bg-raised p-2.5">
                <p className="text-[11.5px] font-semibold">
                  {result.sync.changed_blocks.length} block(s) changed · {result.sync.unchanged.length} reused ·{' '}
                  <span className="text-ok">{result.sync.transfer.saving_pct}% saved</span>
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  full {(result.sync.transfer.full_gzip_bytes / 1024).toFixed(1)} kB → delta{' '}
                  {(result.sync.transfer.delta_gzip_bytes / 1024).toFixed(1)} kB
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {result.sync.unchanged.map((b) => (
                    <span key={b} className="rounded bg-ok/12 px-1.5 py-0.5 text-[10px] font-medium text-ok">
                      {b} ✓
                    </span>
                  ))}
                  {result.sync.changed_blocks.map((b) => (
                    <span key={b} className="rounded bg-warn/12 px-1.5 py-0.5 text-[10px] font-medium text-warn">
                      {b} ↻
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[12px] text-muted">No read recorded yet.</p>
        )}
      </Card>

      <Card>
        <p className="label mb-2">Payload budget (target &lt; 50 kB gzip)</p>
        {report ? (
          <>
            <div className="flex items-baseline gap-2">
              <p className="metric text-xl font-bold text-ok">{(report.total_gzip_bytes / 1024).toFixed(1)} kB</p>
              <p className="text-[11.5px] text-muted">of 50 kB · raw {(report.total_bytes / 1024).toFixed(1)} kB</p>
            </div>
            <div className="mt-1.5">
              <Meter value={report.total_gzip_bytes} max={51200} colour="ok" />
            </div>
            <div className="mt-2.5 space-y-1">
              {blocks.map(([name, v]: any) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-[86px] shrink-0 truncate text-[11px] text-muted">{name}</span>
                  <div className="min-w-0 flex-1">
                    <Meter value={v.gzip_bytes} max={(blocks[0][1] as any).gzip_bytes} colour="rain" />
                  </div>
                  <span className="metric w-14 shrink-0 text-right text-[10.5px] text-muted">{v.gzip_bytes} B</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[12px] text-muted">Unavailable offline.</p>
        )}
      </Card>

      <Card>
        <p className="label mb-2">Edge cache</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="label">Driver</div>
            <div className="text-[11.5px] font-semibold leading-snug">{driver.name}</div>
          </div>
          <div>
            <div className="label">Cached bulletins</div>
            <div className="metric text-[12.5px] font-semibold">{driver.keys().length}</div>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted">
          Keys: {driver.keys().join(' · ') || '—'}
        </p>
      </Card>

      <Card>
        <p className="label mb-2">{t('spokenBulletin')} · {lang}</p>
        <p className="text-[12.5px] leading-relaxed">{voiceText}</p>
      </Card>

      <Card>
        <p className="label mb-2">Transfer log</p>
        <div className="space-y-1.5">
          {transferLog.slice(0, 8).map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span
                className={`w-12 shrink-0 rounded px-1 py-0.5 text-center text-[9.5px] font-bold ${
                  e.kind === 'delta' ? 'bg-ok/12 text-ok' : e.kind === 'cache' ? 'bg-warn/12 text-warn' : 'bg-rain/12 text-rain'
                }`}
              >
                {e.kind}
              </span>
              <span className="metric w-16 shrink-0 text-muted">{(e.bytes / 1024).toFixed(2)} kB</span>
              <span className="min-w-0 flex-1 truncate text-muted">{e.note}</span>
            </div>
          ))}
          {!transferLog.length ? <p className="text-[12px] text-muted">No transfers yet.</p> : null}
        </div>
      </Card>

      <Card>
        <p className="label mb-2">{t('sources')}</p>
        <ul className="space-y-1.5 text-[11.5px] leading-snug text-muted">
          <li>• India Meteorological Department — station observations, district forecast, CAP warnings</li>
          <li>• Gramin Krishi Mausam Sewa (GKMS) / AMFU — agromet advisories</li>
          <li>• Central Pollution Control Board (CPCB) — AQI, PM2.5 / PM10 sub-indices</li>
          <li>• ISRO MOSDAC / INCOIS — INSAT-3D imagery, cyclone track, sea state</li>
          <li>• NDMA Sachet — Common Alerting Protocol v1.2 feed</li>
          <li>• Bhashini (ULCA) — Indic TTS pipeline for spoken bulletins</li>
        </ul>
        <p className="mt-2 text-[10.5px] leading-snug text-muted">
          Prototype build: all feeds are deterministic mock datasets that mirror the published schemas. Swapping in live
          keys is an environment-variable change on the backend.
        </p>
      </Card>
    </div>
  );
}
