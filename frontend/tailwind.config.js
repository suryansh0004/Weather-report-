const DATA_COLOURS = ['accent', 'rain', 'crop', 'soil', 'danger', 'warn', 'caution', 'ok', 'ink', 'muted', 'line'];
const ALPHA = ['/10', '/12', '/15', '/20', '/40', '/60'];
const alphaClasses = DATA_COLOURS.flatMap((c) =>
  ALPHA.flatMap((a) => [`bg-${c}${a}`, `border-${c}${a}`, `text-${c}${a}`]),
);

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Widget colours are chosen at runtime from API severity fields, so the
  // utilities are composed dynamically and must be safelisted.
  safelist: [
    ...alphaClasses,
    {
      pattern:
        /^(bg|text|stroke|fill|border)-(accent|rain|crop|soil|danger|warn|caution|ok|ink|muted|line|surface|raised)$/,
    },
  ],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        rain: 'rgb(var(--c-rain) / <alpha-value>)',
        crop: 'rgb(var(--c-crop) / <alpha-value>)',
        soil: 'rgb(var(--c-soil) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        caution: 'rgb(var(--c-caution) / <alpha-value>)',
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Noto Sans"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.18)',
        lift: '0 2px 6px rgb(0 0 0 / 0.10), 0 18px 40px -18px rgb(0 0 0 / 0.30)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        pulseRing: { '0%': { opacity: 0.55, transform: 'scale(0.3)' }, '100%': { opacity: 0, transform: 'scale(1)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        'fade-up': 'fade-up 320ms cubic-bezier(0.22,1,0.36,1) both',
        ring: 'pulseRing 2.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
