import type { ReactNode } from 'react';

/* ── Logo ─────────────────────────────────────────────────────────────── */

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="Mausam" role="img">
      <circle cx="20.5" cy="11.5" r="4.5" stroke="currentColor" strokeWidth="2" opacity="0.55" />
      <path
        d="M6 17.5h13.5a3.5 3.5 0 1 0-3.4-4.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 21.5v3.5M15.5 21.5v4.5M21 21.5v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ── Icons (24px stroke set, currentColor) ────────────────────────────── */

type IconName =
  | 'home' | 'radar' | 'leaf' | 'sync' | 'pin' | 'speaker' | 'stop' | 'globe' | 'chevron'
  | 'sun' | 'cloud' | 'rain' | 'storm' | 'fog' | 'wind' | 'drop' | 'eye' | 'alert' | 'wave'
  | 'moon' | 'up' | 'down' | 'grip' | 'refresh' | 'offline' | 'check' | 'bus' | 'bag' | 'seed';

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M4 11.5 12 4l8 7.5V20H4v-8.5Z" />,
  radar: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 12l6-4" />
    </>
  ),
  leaf: <path d="M5 19c0-7 5-12 14-12 0 9-5 13-11 13H5v-1Zm2-1c3-4 6-6 9-7" />,
  sync: <path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6M18 3v4h-4M6 21v-4h4" />,
  pin: (
    <>
      <path d="M12 21s6.5-6.2 6.5-11a6.5 6.5 0 1 0-13 0C5.5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  speaker: <path d="M5 10v4h3l4 3.5v-15L8 10H5Zm11-1.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 2.4 14.1 0 17M12 3.5c-2.4 2.4-2.4 14.1 0 17" />
    </>
  ),
  chevron: <path d="M6 9.5 12 15l6-5.5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </>
  ),
  cloud: <path d="M6.5 18h10a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6 1.4A3.1 3.1 0 0 0 6.5 18Z" />,
  rain: (
    <>
      <path d="M6.5 14h10a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6 1.4A3.1 3.1 0 0 0 6.5 14Z" />
      <path d="M9 17v3M13 17v3.5M17 17v2.5" />
    </>
  ),
  storm: (
    <>
      <path d="M6.5 13h10a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6 1.4A3.1 3.1 0 0 0 6.5 13Z" />
      <path d="M13 15l-3 3h3l-1.5 3.5 4-4.5h-3l1-2Z" />
    </>
  ),
  fog: <path d="M4 9h16M6 13h12M4 17h16" />,
  wind: <path d="M3 9h10a3 3 0 1 0-3-3M3 15h13a3 3 0 1 1-3 3M3 12h7" />,
  drop: <path d="M12 3.5S6.5 10 6.5 14a5.5 5.5 0 0 0 11 0C17.5 10 12 3.5 12 3.5Z" />,
  eye: (
    <>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 3 19.5h18L12 4Z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  wave: <path d="M2.5 9c2.5 0 3 2 5 2s2.5-2 5-2 2.5 2 4.5 2 2-2 4.5-2M2.5 15c2.5 0 3 2 5 2s2.5-2 5-2 2.5 2 4.5 2 2-2 4.5-2" />,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  up: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  down: <path d="M12 5v14m0 0 6-6m-6 6-6-6" />,
  grip: <path d="M9 7h.01M9 12h.01M9 17h.01M15 7h.01M15 12h.01M15 17h.01" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4" />,
  offline: (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.5M19 13a10 10 0 0 0-6-2.9M12 20h.01" />
    </>
  ),
  check: <path d="M5 13l4.5 4.5L19 7" />,
  bus: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="2.5" />
      <path d="M4 11h16M7.5 19.5h.01M16.5 19.5h.01M7 16v3M17 16v3" />
    </>
  ),
  bag: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="2.5" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  seed: <path d="M12 21V11m0 0a5 5 0 0 1 5-5h2a7 7 0 0 1-7 7Zm0 0a5 5 0 0 0-5-5H5a7 7 0 0 0 7 7Z" />,
};

export function Icon({
  name,
  size = 20,
  className = '',
  strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

const SKY_ICON: Record<string, IconName> = {
  clear: 'sun',
  partly_cloudy: 'cloud',
  cloudy: 'cloud',
  light_rain: 'rain',
  moderate_rain: 'rain',
  heavy_rain: 'rain',
  thunderstorm: 'storm',
  fog: 'fog',
  haze: 'fog',
};
export const skyIcon = (code: string): IconName => SKY_ICON[code] ?? 'cloud';

/* ── layout atoms ─────────────────────────────────────────────────────── */

export function Card({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card p-3.5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Stat({ label, value, unit, tone = 'ink' }: { label: string; value: ReactNode; unit?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className={`metric mt-0.5 text-[15px] font-semibold text-${tone}`}>
        {value}
        {unit ? <span className="ml-0.5 text-[11px] font-medium text-muted">{unit}</span> : null}
      </div>
    </div>
  );
}

export const COLOUR_TOKEN: Record<string, string> = {
  RED: 'danger',
  ORANGE: 'warn',
  YELLOW: 'caution',
  GREEN: 'ok',
};

/* ── SVG charts (no chart library — vector output keeps the bundle small) ─ */

export function Sparkline({
  values,
  height = 34,
  stroke = 'rain',
  fill = true,
}: {
  values: number[];
  height?: number;
  stroke?: string;
  fill?: boolean;
}) {
  if (!values.length) return null;
  const w = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - 3 - ((v - min) / span) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      {fill && (
        <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} className={`fill-${stroke}`} opacity="0.14" />
      )}
      <polyline
        points={pts.join(' ')}
        fill="none"
        className={`stroke-${stroke}`}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BarSeries({
  items,
  height = 56,
  colour = 'rain',
  unit = '',
}: {
  items: { label: string; value: number }[];
  height?: number;
  colour?: string;
  unit?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex items-end gap-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="metric text-[9px] text-muted">
            {it.value}
            {unit}
          </span>
          <div className="flex w-full items-end justify-center" style={{ height }}>
            <div
              className={`w-full rounded-t-[3px] bg-${colour} transition-all duration-500`}
              style={{ height: `${Math.max(3, (it.value / max) * height)}px`, opacity: 0.35 + 0.65 * (it.value / max) }}
            />
          </div>
          <span className="w-full truncate text-center text-[9px] text-muted">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Gauge({
  value,
  max = 100,
  label,
  sub,
  colour = 'accent',
  size = 92,
}: {
  value: number;
  max?: number;
  label: string;
  sub?: string;
  colour?: string;
  size?: number;
}) {
  const r = size / 2 - 7;
  const c = Math.PI * r * 1.5; // 270° arc
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden="true">
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className="stroke-line"
            strokeWidth="7"
            strokeDasharray={`${c} 999`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className={`stroke-${colour} transition-all duration-700`}
            strokeWidth="7"
            strokeDasharray={`${c * pct} 999`}
            strokeLinecap="round"
          />
        </g>
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dy="0.02em"
          className={`metric fill-ink text-[19px] font-bold`}
          style={{ fontSize: 19 }}
        >
          {value}
        </text>
        <text x="50%" y="50%" dy="1.35em" textAnchor="middle" className="fill-muted" style={{ fontSize: 8.5 }}>
          {label}
        </text>
      </svg>
      {sub ? <p className="text-xs leading-snug text-muted">{sub}</p> : null}
    </div>
  );
}

/** Horizontal severity / suitability meter. */
export function Meter({ value, max = 100, colour = 'accent' }: { value: number; max?: number; colour?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div
        className={`h-full rounded-full bg-${colour} transition-all duration-700`}
        style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%` }}
      />
    </div>
  );
}
