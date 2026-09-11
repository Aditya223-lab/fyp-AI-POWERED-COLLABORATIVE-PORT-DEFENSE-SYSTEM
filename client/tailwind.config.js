/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Restrained slate-navy neutrals + a single blue accent family.
        // "purple"/"pink" are kept as token names for compatibility but
        // resolve to muted indigo so nothing in the UI reads neon.
        primary: {
          DEFAULT: '#0d1522',
          light: '#16202f',
          dark: '#0a101a',
        },
        accent: {
          blue: '#3b82f6',
          cyan: '#38bdf8',
          green: '#34d399',
          red: '#ef4444',
          yellow: '#f0b429',
          orange: '#f97316',
          purple: '#818cf8',
          pink: '#818cf8',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: [
          'var(--font-display)',
          'var(--font-sans)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'var(--font-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      boxShadow: {
        // Former neon glows — now soft, low-opacity ambient shadows.
        'glow-cyan': '0 4px 20px rgba(56, 189, 248, 0.10)',
        'glow-purple': '0 4px 20px rgba(129, 140, 248, 0.10)',
        'glow-green': '0 4px 20px rgba(52, 211, 153, 0.10)',
        'glow-red': '0 4px 20px rgba(239, 68, 68, 0.12)',
        'glow-yellow': '0 4px 20px rgba(240, 180, 41, 0.10)',
        'glow-pink': '0 4px 20px rgba(129, 140, 248, 0.10)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 12s linear infinite',
        'grid-fade': 'grid-fade 8s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
        aurora: 'aurora 14s ease-in-out infinite alternate',
        'fade-up': 'fade-up 0.5s ease-out both',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'grid-fade': {
          '0%, 100%': { opacity: '0.15' },
          '50%': { opacity: '0.35' },
        },
        shimmer: {
          to: { backgroundPosition: '200% center' },
        },
        aurora: {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(4%, -6%) scale(1.08)' },
          '100%': { transform: 'translate(-4%, 4%) scale(0.96)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'cyber-grid':
          'linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)',
        'radial-glow':
          'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.08), transparent 60%)',
      },
    },
  },
  plugins: [],
};
