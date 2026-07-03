import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Violet-cast blacks — the 60% canvas of the brand (matches the hero art).
        ink: {
          950: '#050309',
          900: '#0a0714',
          800: '#120b22',
          700: '#1b1233',
        },
        veil: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Electric blue side of the logo gradient (blue → violet).
        pulse: {
          400: '#7b8cff',
          500: '#5b6cff',
          600: '#4353e8',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // φ-derived display sizes on top of Tailwind's UI scale (base 17 × 1.618ⁿ).
      fontSize: {
        'display-sm': ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        display: ['2.8rem', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        'display-lg': ['4.5rem', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
      },
      keyframes: {
        'proof-pulse': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.06)' },
        },
        'ring-expand': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'proof-pulse': 'proof-pulse 2.4s ease-in-out infinite',
        'ring-expand': 'ring-expand 0.5s cubic-bezier(0.16,1,0.3,1)',
        'slide-in': 'slide-in 0.3s cubic-bezier(0.16,1,0.3,1)',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
