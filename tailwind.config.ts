import type { Config } from 'tailwindcss';

/**
 * Colours are semantic tokens resolved from CSS variables, so every component
 * is theme-agnostic: `bg-panel`, `border-hair`, `text-muted` work in both the
 * dark and light themes without a single `dark:` variant.
 */
const config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        panel: 'var(--panel)',
        raised: 'var(--raised)',
        hair: 'var(--hair)',
        edge: 'var(--edge)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-tint': 'var(--accent-tint)',
        violet: 'var(--violet)',
        ok: 'var(--ok)',
        'ok-tint': 'var(--ok-tint)',
        warn: 'var(--warn)',
        'warn-tint': 'var(--warn-tint)',
        err: 'var(--err)',
        'err-tint': 'var(--err-tint)',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Inter',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xl: '14px',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        orb: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.9' },
          '50%': { transform: 'scale(1.12)', opacity: '1' },
        },
        sweep: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        rise: 'rise 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        orb: 'orb 3.4s ease-in-out infinite',
        sweep: 'sweep 2.4s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
