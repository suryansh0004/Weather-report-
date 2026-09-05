import { useState } from 'react';
import type { HomePayload, Widget } from '../lib/types';
import { skyLabel, widgetTitle } from '../lib/i18n';
import { BarSeries, Card, Gauge, Icon, Meter, Sparkline, skyIcon } from './ui';

interface Ctx {
  p: HomePayload;
  lang: string;
  t: (k: string) => string;
}

const RISK_TONE: Record<string, string> = {
  low: 'ok',
  moderate: 'caution',
  medium: 'caution',
  high: 'danger',
  severe: 'danger',
  caution: 'caution',
  clear: 'ok',
  Low: 'ok',
  Moderate: 'caution',
  High: 'danger',
  Poor: 'danger',
  Fair: 'caution',
  Good: 'ok',
  Marginal: 'caution',
  Favourable: 'ok',
  Unfavourable: 'danger',
};
const tone = (v?: string | null) => RISK_TONE[v ?? ''] ?? 'accent';

function Row({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between gap-3 ${className}`}>{children}</div>;
}

function Pill({ text, colour = 'accent' }: { text: string; colour?: string }) {
  return (
    <span className={`shrink-0 rounded-full bg-${colour}/12 px-2 py-0.5 text-[10.5px] font-semibold text-${colour}`}>
      {text}
    </span>
  );
}

function Bullets({ items, max = 4 }: { items: string[]; max?: number }) {
  return (
    <ul className="space-y-1.5">
      {items.slice(0, max).map((it, i) => (
        <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-muted">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── individual widget bodies ─────────────────────────────────────────── */

const bodies: Record<string, (c: Ctx) => React.ReactNode> = {
  nowcast: ({ p, lang }) => {
    const nc = p.persona_data?.nowcast;
    if (!nc) return <p className="text-xs text-muted">Radar nowcast unavailable for this station.</p>;
    const headline = nc.in_progress
      ? 'Rain in progress now'
      : nc.onset_in_min == null
        ? 'No rain expected in the next hour'
        : `Rain starting in about ${nc.onset_in_min} min`;
    return (
      <>
        <Row>
          <p className="min-w-0 text-[13px] font-semibold leading-snug">{headline}</p>
          <Pill text={nc.band.replace('_', ' ')} colour={nc.band === 'heavy' ? 'danger' : nc.band === 'no_rain' ? 'ok' : 'rain'} />
        </Row>
        <div className="mt-2.5">
          <BarSeries
            items={nc.steps
              .filter((_: unknown, i: number) => i % 2 === 0)
              .map((s: any) => ({ label: `${s.offset_min}′`, value: Math.round(s.intensity_mmph * 10) / 10 }))}
            height={44}
            colour="rain"
          />
        </div>
        <p className="mt-2 text-[11px] text-muted">
          {nc.radar_station} · echo top {nc.echo_top_km} km · cell {nc.cell_movement} · peak {nc.peak_intensity_mmph} mm/h at
          +{nc.peak_in_min}′ · {skyLabel(p.observation.sky_code, lang)}
        </p>
      </>
    );
  },

  aqi: ({ p, t }) => {
    const a = p.air_quality;
    const colour = a.aqi <= 50 ? 'ok' : a.aqi <= 100 ? 'crop' : a.aqi <= 200 ? 'caution' : a.aqi <= 300 ? 'warn' : 'danger';
    return (
      <>
        <div className="flex items-start gap-3">
          <Gauge value={a.aqi} max={500} label={t('aqi')} colour={colour} size={86} />
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-semibold text-${colour}`}>{a.category}</p>
            <p className="mt-1 text-[11.5px] leading-snug text-muted">{a.health_advice}</p>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-2 border-t border-line pt-2.5">
          {Object.entries(a.concentrations_ug_m3)
            .slice(0, 4)
            .map(([k, v]) => (
              <div key={k} className="min-w-0">
                <div className="label truncate">{k.replace('_', '.')}</div>
                <div className="metric text-[12.5px] font-semibold">{v}</div>
              </div>
            ))}
        </div>
        <p className="mt-2 text-[10.5px] text-muted">
          CPCB {a.station} · dominant {a.dominant_pollutant.replace('_', '.')}
        </p>
      </>
    );
  },

  uv: ({ p }) => (
    <Row>
      <div className="min-w-0">
        <p className="metric text-xl font-bold">{p.observation.uv_index}</p>
        <p className="text-[12px] font-semibold">{p.uv.band}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{p.uv.advice}</p>
      </div>
      <Icon name="sun" size={34} className="shrink-0 text-caution" />
    </Row>
  ),

  agromet: ({ p }) => {
    const b = p.persona_data?.bulletin;
    if (!b) return null;
    return (
      <>
        <div className="flex flex-wrap gap-1.5">
          <Pill text={b.season} colour="crop" />
          <Pill text={b.agro_climatic_zone} colour="soil" />
        </div>
        <div className="mt-2.5 space-y-2.5">
          {b.advisories.slice(0, 3).map((a: any, i: number) => (
            <div key={i} className="rounded-xl border border-line bg-raised p-2.5">
              <Row>
                <p className="truncate text-[12.5px] font-semibold">
                  {a.crop} · <span className="font-normal text-muted">{a.stage}</span>
                </p>
                <Pill text={a.priority} colour={a.priority === 'high' ? 'danger' : 'caution'} />
              </Row>
              <p className="mt-1.5 text-[12px] leading-snug text-muted">{a.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-muted">
          {b.amfu} · valid till {b.valid_till}
        </p>
      </>
    );
  },

  soil: ({ p, t }) => {
    const trend = p.persona_data?.soil_trend ?? [];
    if (!trend.length) return null;
    return (
      <>
        <Row>
          <p className="metric text-xl font-bold text-soil">
            {trend.find((d: any) => d.date === trend[3]?.date)?.moisture_pct ?? trend[0].moisture_pct}
            <span className="ml-0.5 text-xs font-medium text-muted">%</span>
          </p>
          <Pill text={`${t('soilMoisture')} · 0–15 cm`} colour="soil" />
        </Row>
        <div className="mt-2">
          <BarSeries
            items={trend.map((d: any) => ({ label: d.day_label, value: d.moisture_pct }))}
            height={46}
            colour="soil"
            unit="%"
          />
        </div>
        <p className="mt-1.5 text-[10.5px] text-muted">Observed (past 3 days) and modelled outlook · GKMS soil-water balance</p>
      </>
    );
  },

  spraying: ({ p }) => {
    const s = p.persona_data?.spraying;
    if (!s) return null;
    return (
      <>
        <Row>
          <div className="min-w-0">
            <p className={`text-[13.5px] font-bold text-${s.suitable ? 'ok' : 'danger'}`}>{s.verdict}</p>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Best window {s.window_start}–{s.window_end} IST
            </p>
          </div>
          <Pill text={`${s.score}/100`} colour={s.suitable ? 'ok' : 'danger'} />
        </Row>
        <div className="mt-2">
          <Meter value={s.score} colour={s.suitable ? 'ok' : 'danger'} />
        </div>
        <div className="mt-2.5">
          <Sparkline values={s.timeline.map((x: any) => x.score)} stroke="crop" height={30} />
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>{s.timeline[0]?.hour}</span>
            <span>{s.timeline[Math.floor(s.timeline.length / 2)]?.hour}</span>
            <span>{s.timeline[s.timeline.length - 1]?.hour}</span>
          </div>
        </div>
        {s.limiting_factors?.length ? (
          <p className="mt-1.5 text-[11px] text-muted">Limiting: {s.limiting_factors.join(', ')}</p>
        ) : null}
      </>
    );
  },

  sowing: ({ p }) => {
    const s = p.persona_data?.sowing;
    if (!s) return null;
    return (
      <>
        <div className="flex items-start gap-3">
          <Gauge value={s.score} label={s.season} colour={tone(s.band)} size={86} />
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-semibold text-${tone(s.band)}`}>{s.band}</p>
            <p className="mt-1 text-[11px] text-muted">
              7-day rain {s.expected_rain_7d_mm} mm · mean {s.mean_temp_c} °C
            </p>
          </div>
        </div>
        <div className="mt-2 border-t border-line pt-2">
          <Bullets items={s.notes} max={3} />
        </div>
      </>
    );
  },

  irrigation: ({ p }) => {
    const ir = p.persona_data?.irrigation;
    if (!ir) return null;
    return (
      <>
        <Row>
          <p className="metric text-xl font-bold text-rain">
            {ir.irrigation_need_mm}
            <span className="ml-0.5 text-xs font-medium text-muted">mm</span>
          </p>
          <Icon name="drop" size={28} className="text-rain" />
        </Row>
        <p className="mt-1 text-[12px] leading-snug text-muted">{ir.recommendation}</p>
        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-2">
          <div>
            <div className="label">ET₀</div>
            <div className="metric text-[12.5px] font-semibold">{ir.reference_et0_mm_day}</div>
          </div>
          <div>
            <div className="label">Rain 3d</div>
            <div className="metric text-[12.5px] font-semibold">{ir.expected_rain_3d_mm}</div>
          </div>
          <div>
            <div className="label">Soil</div>
            <div className="metric text-[12.5px] font-semibold">{ir.soil_moisture_pct}%</div>
          </div>
        </div>
      </>
    );
  },

  farm_hazards: ({ p }) => {
    const hz = p.persona_data?.hazards ?? [];
    if (!hz.length)
      return <p className="text-[12.5px] text-ok">No crop-damaging weather expected this week.</p>;
    return (
      <div className="space-y-2">
        {hz.slice(0, 3).map((h: any, i: number) => (
          <div key={i} className="flex gap-2.5">
            <span className="mt-0.5 shrink-0 text-warn">
              <Icon name={h.type === 'thunderstorm' ? 'storm' : h.type === 'heavy_rain' ? 'rain' : 'alert'} size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold">
                {h.day_label} · {h.type.replace('_', ' ')}
              </p>
              <p className="text-[11.5px] leading-snug text-muted">{h.detail}</p>
            </div>
          </div>
        ))}
      </div>
    );
  },

  forecast7: ({ p, lang }) => (
    <div className="-mx-1 divide-y divide-line">
      {p.daily.slice(0, 7).map((d) => (
        <div key={d.date} className="flex items-center gap-2 px-1 py-1.5">
          <span className="w-9 shrink-0 text-[12px] font-semibold">{d.day_label}</span>
          <Icon name={skyIcon(d.sky_code)} size={17} className="shrink-0 text-rain" />
          <span className="metric w-10 shrink-0 text-[11.5px] text-rain">{d.rain_prob_pct}%</span>
          <div className="min-w-0 flex-1">
            <Meter value={d.temp_max_c} max={48} colour={d.temp_max_c >= 40 ? 'danger' : 'caution'} />
          </div>
          <span className="metric w-16 shrink-0 whitespace-nowrap text-right text-[12px] font-semibold">
            {Math.round(d.temp_max_c)}° / {Math.round(d.temp_min_c)}°
          </span>
        </div>
      ))}
      <p className="px-1 pt-2 text-[10.5px] text-muted">
        {skyLabel(p.daily[0].sky_code, lang)} today · IMD district forecast
      </p>
    </div>
  ),

  hourly: ({ p }) => (
    <>
      <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {p.hourly.slice(0, 12).map((h) => (
          <div key={h.time} className="w-[46px] shrink-0 text-center">
            <div className="text-[10.5px] text-muted">{h.hour}</div>
            <Icon name={skyIcon(h.sky_code)} size={17} className="mx-auto my-1 text-rain" />
            <div className="metric text-[12.5px] font-semibold">{Math.round(h.temp_c)}°</div>
            <div className="metric text-[10px] text-rain">{h.rain_prob_pct}%</div>
          </div>
        ))}
      </div>
      <div className="mt-1.5">
        <Sparkline values={p.hourly.slice(0, 24).map((h) => h.temp_c)} stroke="caution" height={30} />
      </div>
    </>
  ),

  waterlogging: ({ p }) => {
    const w = p.persona_data?.waterlogging;
    if (!w) return null;
    return (
      <>
        <Row>
          <p className="text-[12.5px] font-semibold">Overall risk</p>
          <Pill text={w.overall_risk} colour={tone(w.overall_risk)} />
        </Row>
        <div className="mt-2 space-y-1.5">
          {w.spots.slice(0, 4).map((s: any, i: number) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-raised px-2 py-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-${tone(s.risk)}`} />
              <span className="min-w-0 flex-1 truncate text-[12px]">{s.location}</span>
              <span className={`metric shrink-0 text-[11.5px] font-semibold text-${tone(s.risk)}`}>
                ~{s.expected_depth_cm} cm
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-muted">{w.municipal_source}</p>
      </>
    );
  },

  routes: ({ p }) => {
    const routes = p.persona_data?.routes ?? [];
    if (!routes.length) return null;
    return (
      <div className="space-y-2">
        {routes.slice(0, 4).map((r: any, i: number) => (
          <div key={i} className="rounded-xl border border-line bg-raised p-2.5">
            <Row>
              <p className="min-w-0 truncate text-[12.5px] font-semibold">{r.route}</p>
              <Pill text={`+${r.expected_delay_min} min`} colour={tone(r.status)} />
            </Row>
            {r.hazards?.length ? (
              <p className="mt-1 text-[11.5px] leading-snug text-muted">{r.hazards[0]}</p>
            ) : null}
          </div>
        ))}
      </div>
    );
  },

  comfort: ({ p }) => {
    const c = p.persona_data?.comfort;
    if (!c) return null;
    return (
      <>
        <p className="text-[13px] font-semibold">{c.headline}</p>
        <p className="mt-1 text-[12px] leading-snug text-muted">{c.two_wheeler_advice}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-2">
          <div>
            <div className="label">Best departure</div>
            <div className="metric text-[12.5px] font-semibold">{c.best_departure?.hour}</div>
          </div>
          <div>
            <div className="label">Umbrella</div>
            <div className="text-[12.5px] font-semibold">{c.umbrella_needed ? 'Yes' : 'Not needed'}</div>
          </div>
        </div>
      </>
    );
  },

  itinerary: ({ p }) => {
    const legs = p.persona_data?.itinerary ?? [];
    return (
      <div className="space-y-2">
        {legs.map((l: any) => (
          <div key={l.leg} className="flex items-center gap-2.5 rounded-xl border border-line bg-raised p-2.5">
            <Icon name={skyIcon(l.sky_code)} size={19} className="shrink-0 text-rain" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold">
                {l.city} <span className="font-normal text-muted">· {l.day_label}</span>
              </p>
              <p className="truncate text-[11px] text-muted">{l.verdict}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="metric text-[12.5px] font-semibold">
                {Math.round(l.temp_max_c)}°/{Math.round(l.temp_min_c)}°
              </div>
              <div className="metric text-[10.5px] text-rain">{l.rain_prob_pct}%</div>
            </div>
          </div>
        ))}
      </div>
    );
  },

  hills: ({ p }) => {
    const m = p.persona_data?.mountain;
    if (!m?.applicable) return <p className="text-[12.5px] text-muted">Not a mountain district.</p>;
    return (
      <>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-line bg-raised p-2.5">
            <div className="label">Landslide</div>
            <p className={`text-[13px] font-bold text-${tone(m.landslide.band)}`}>{m.landslide.band}</p>
            <div className="mt-1.5">
              <Meter value={m.landslide.score} colour={tone(m.landslide.band)} />
            </div>
          </div>
          <div className="rounded-xl border border-line bg-raised p-2.5">
            <div className="label">Visibility</div>
            <p className={`text-[13px] font-bold text-${tone(m.visibility.band)}`}>{m.visibility.km} km</p>
            <p className="mt-0.5 text-[11px] text-muted">{m.visibility.band}</p>
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-snug text-muted">{m.landslide.advice}</p>
        <p className="mt-1.5 text-[11px] text-muted">
          72h rain {m.cumulative_rain_72h_mm} mm · trek window {m.trek_window}
          {m.snow_note ? ` · ${m.snow_note}` : ''}
        </p>
      </>
    );
  },

  packing: ({ p }) => {
    const pk = p.persona_data?.packing;
    if (!pk) return null;
    return (
      <>
        <Row>
          <Pill text={pk.clothing_index} colour="accent" />
          <span className="metric text-[11.5px] text-muted">
            {pk.temp_band_c[0]}° – {pk.temp_band_c[1]}°
          </span>
        </Row>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pk.items.map((it: string, i: number) => (
            <span key={i} className="rounded-lg border border-line bg-raised px-2 py-1 text-[11.5px] text-muted">
              {it}
            </span>
          ))}
        </div>
      </>
    );
  },

  cyclone: ({ p }) => {
    const s = p.persona_data?.active_system;
    if (!s) return <p className="text-[12.5px] text-ok">No cyclonic system in the basin right now.</p>;
    const lats = s.track.map((t: any) => t.lat);
    const lons = s.track.map((t: any) => t.lon);
    const minLat = Math.min(...lats) - 0.6, maxLat = Math.max(...lats) + 0.6;
    const minLon = Math.min(...lons) - 0.6, maxLon = Math.max(...lons) + 0.6;
    const X = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * 260 + 10;
    const Y = (lat: number) => 120 - ((lat - minLat) / (maxLat - minLat)) * 100;
    const obs = s.track.filter((t: any) => !t.forecast);
    const fc = s.track.filter((t: any) => t.forecast);
    const line = (arr: any[]) => arr.map((t) => `${X(t.lon).toFixed(1)},${Y(t.lat).toFixed(1)}`).join(' ');
    const cur = s.current;
    return (
      <>
        <Row>
          <p className="min-w-0 truncate text-[13px] font-bold">{s.name}</p>
          <Pill text={s.category.replace(/\(.*\)/, '').trim()} colour="danger" />
        </Row>
        <svg viewBox="0 0 280 130" className="mt-2 w-full rounded-xl bg-raised" style={{ height: 132 }} aria-label="Cyclone track">
          <defs>
            <pattern id="sea" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M0 9h10" className="stroke-line" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="280" height="130" fill="url(#sea)" opacity="0.7" />
          <polyline points={line(obs)} fill="none" className="stroke-muted" strokeWidth="1.6" />
          <polyline points={line([obs[obs.length - 1], ...fc])} fill="none" className="stroke-danger" strokeWidth="1.6" strokeDasharray="4 3" />
          {s.track.map((t: any, i: number) => (
            <circle
              key={i}
              cx={X(t.lon)}
              cy={Y(t.lat)}
              r={t.stage === 'Landfall' ? 4 : 2.6}
              className={t.forecast ? 'fill-danger' : 'fill-muted'}
            />
          ))}
          <circle cx={X(cur.lon)} cy={Y(cur.lat)} r="9" className="fill-danger animate-ring" opacity="0.4" />
          <circle cx={X(cur.lon)} cy={Y(cur.lat)} r="4.5" className="fill-danger" />
        </svg>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <div className="label">Wind</div>
            <div className="metric text-[12.5px] font-semibold">{cur.max_sustained_wind_kmph} km/h</div>
          </div>
          <div>
            <div className="label">Pressure</div>
            <div className="metric text-[12.5px] font-semibold">{cur.central_pressure_hpa} hPa</div>
          </div>
          <div>
            <div className="label">From you</div>
            <div className="metric text-[12.5px] font-semibold">{s.distance_from_you_km} km</div>
          </div>
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-muted">
          {cur.movement} · landfall {new Date(cur.expected_landfall).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} IST · {cur.landfall_zone}
        </p>
        <p className="mt-1 text-[10.5px] text-muted">ISRO MOSDAC / IMD Area Cyclone Warning Centre feed</p>
      </>
    );
  },

  sea: ({ p }) => {
    const s = p.persona_data?.sea_state;
    if (!s) return <p className="text-[12.5px] text-muted">Inland district — no marine bulletin.</p>;
    return (
      <>
        <Row>
          <div className="min-w-0">
            <p className="metric text-xl font-bold text-rain">
              {s.wave_height_m}
              <span className="ml-0.5 text-xs font-medium text-muted">m</span>
            </p>
            <p className="text-[12px] font-semibold">{s.sea_condition}</p>
          </div>
          <Pill text={s.safe_to_sail ? 'Safe to sail' : 'Do not sail'} colour={s.safe_to_sail ? 'ok' : 'danger'} />
        </Row>
        <div className={`mt-2 rounded-xl border border-${s.safe_to_sail ? 'line' : 'danger'}/40 bg-${s.safe_to_sail ? 'raised' : 'danger'}/10 p-2.5`}>
          <p className="text-[12px] font-medium leading-snug">{s.fishermen_warning}</p>
        </div>
        <p className="mt-2 text-[11px] text-muted">High tide: {(s.high_tide ?? []).join(' · ')}</p>
        <p className="mt-1 text-[10.5px] text-muted">{s.issued_by}</p>
      </>
    );
  },

  evacuation: ({ p, t }) => {
    const e = p.persona_data?.evacuation;
    if (!e) return null;
    return (
      <>
        <p className="text-[12.5px] font-semibold leading-snug">{e.trigger}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {e.helplines.map((h: any) => (
            <a
              key={h.number}
              href={`tel:${h.number}`}
              className="rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-[11.5px] font-semibold text-danger"
            >
              {h.label} · {h.number}
            </a>
          ))}
        </div>
        <p className="label mt-2.5">Shelters nearby</p>
        <Bullets items={e.shelters_nearby} max={3} />
        <p className="label mt-2.5">{t('instruction')}</p>
        <Bullets items={e.checklist} max={5} />
      </>
    );
  },

  satellite: ({ p }) => {
    const list = p.persona_data?.satellite_products ?? [];
    return (
      <div className="space-y-1.5">
        {list.map((s: any, i: number) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-raised px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[11.5px]">{s.product}</span>
            <span className="metric shrink-0 text-[10.5px] text-muted">{s.resolution_km} km</span>
          </div>
        ))}
      </div>
    );
  },
};

const ICONS: Record<string, Parameters<typeof Icon>[0]['name']> = {
  nowcast: 'radar', aqi: 'wind', uv: 'sun', agromet: 'leaf', soil: 'drop', spraying: 'seed',
  sowing: 'seed', irrigation: 'drop', farm_hazards: 'alert', forecast7: 'cloud', hourly: 'sun',
  waterlogging: 'wave', routes: 'bus', comfort: 'bus', itinerary: 'bag', hills: 'alert',
  packing: 'bag', cyclone: 'storm', sea: 'wave', evacuation: 'alert', satellite: 'radar',
};

/* ── grid with drag / arrow reordering ────────────────────────────────── */

export function WidgetGrid({
  widgets,
  ctx,
  order,
  onReorder,
  showWhy,
}: {
  widgets: Widget[];
  ctx: Ctx;
  order: string[];
  onReorder: (next: string[]) => void;
  showWhy: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const byId = new Map(widgets.map((w) => [w.id, w]));
  const ids = order.filter((id) => byId.has(id) && bodies[id]);

  const move = (id: string, dir: -1 | 1) => {
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  };

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = ids.filter((x) => x !== dragId);
    next.splice(ids.indexOf(targetId), 0, dragId);
    onReorder(next);
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="stagger space-y-3">
      {ids.map((id, i) => {
        const w = byId.get(id)!;
        return (
          <Card
            key={id}
            draggable
            onDragStart={() => setDragId(id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(id);
            }}
            onDrop={() => drop(id)}
            className={`${dragId === id ? 'drag-ghost' : ''} ${overId === id && dragId !== id ? 'drag-over' : ''}`}
            style={{ animationDelay: `${Math.min(i * 45, 320)}ms` }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-accent">
                <Icon name={ICONS[id] ?? 'cloud'} size={17} />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold tracking-[-0.01em]">
                {widgetTitle(id, ctx.lang, w.title)}
              </h3>
              <span className="metric shrink-0 text-[10px] text-muted">#{i + 1}</span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={() => move(id, -1)}
                  aria-label="Move up"
                  className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink disabled:opacity-30"
                  disabled={i === 0}
                >
                  <Icon name="up" size={13} />
                </button>
                <button
                  onClick={() => move(id, 1)}
                  aria-label="Move down"
                  className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink disabled:opacity-30"
                  disabled={i === ids.length - 1}
                >
                  <Icon name="down" size={13} />
                </button>
                <span className="cursor-grab text-muted/70">
                  <Icon name="grip" size={14} strokeWidth={2.4} />
                </span>
              </div>
            </div>
            {bodies[id](ctx)}
            {showWhy && w.why?.length ? (
              <div className="mt-2.5 rounded-lg border border-dashed border-line px-2 py-1.5">
                <p className="text-[10.5px] leading-snug text-muted">
                  <span className="font-semibold text-accent">rank {w.rank} · score {w.score}</span> — {w.why.join('; ')}
                </p>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

export const hasBody = (id: string) => Boolean(bodies[id]);

/**
 * A ranked widget is only rendered if the payload actually carries its data.
 * The ranking engine can promote, say, the agromet card for a coastal user; the
 * client still refuses to draw an empty shell.
 */
const AVAILABLE: Record<string, (p: HomePayload) => boolean> = {
  hourly: (p) => Boolean(p.hourly?.length),
  forecast7: (p) => Boolean(p.daily?.length),
  aqi: (p) => Boolean(p.air_quality),
  uv: (p) => Boolean(p.uv),
  nowcast: (p) => Boolean(p.persona_data?.nowcast),
  agromet: (p) => Boolean(p.persona_data?.bulletin),
  soil: (p) => Boolean(p.persona_data?.soil_trend?.length),
  spraying: (p) => Boolean(p.persona_data?.spraying),
  sowing: (p) => Boolean(p.persona_data?.sowing),
  irrigation: (p) => Boolean(p.persona_data?.irrigation),
  farm_hazards: (p) => Array.isArray(p.persona_data?.hazards),
  waterlogging: (p) => Boolean(p.persona_data?.waterlogging),
  routes: (p) => Boolean(p.persona_data?.routes?.length),
  comfort: (p) => Boolean(p.persona_data?.comfort),
  itinerary: (p) => Boolean(p.persona_data?.itinerary?.length),
  hills: (p) => Boolean(p.persona_data?.mountain?.applicable),
  packing: (p) => Boolean(p.persona_data?.packing),
  cyclone: (p) => p.layout.persona === 'coastal' || Boolean(p.persona_data?.active_system),
  sea: (p) => Boolean(p.persona_data?.sea_state),
  evacuation: (p) => Boolean(p.persona_data?.evacuation),
  satellite: (p) => Boolean(p.persona_data?.satellite_products?.length),
};

export const isRenderable = (id: string, p: HomePayload) => Boolean(bodies[id]) && (AVAILABLE[id]?.(p) ?? true);
