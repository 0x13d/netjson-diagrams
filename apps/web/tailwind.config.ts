import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      // Ink theme — the portfolio web standard (EPIC-011): Tufte paper/ink base + the
      // Ink accent set. `ember` (the former network-blue accent) is repointed to Ink
      // brass (#8a6d3b) so existing `text-ember`/`bg-ember` usages resolve to it.
      // `footer` is the constant #3a3a3a footer color. See _shared/web-standard/.
      colors: {
        paper: '#faf7f1',
        paperDim: '#f3eee4',
        ink: '#11120f',
        inkSoft: '#5a5a5a',
        rule: '#3a3a3a',
        ember: '#8a6d3b', // Ink brass (was #1F6FEB network-blue)
        footer: '#3a3a3a', // constant portfolio footer color
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
      keyframes: {
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        riseIn: 'riseIn 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
        fadeIn: 'fadeIn 600ms ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
