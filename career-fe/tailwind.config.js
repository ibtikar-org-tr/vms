/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        muted: '#475569',
        soft: '#f8fafc',
        line: '#e2e8f0',
        brand: {
          DEFAULT: '#0f766e',
          dark: '#0d9488',
          light: '#ccfbf1',
          ink: '#134e4a',
        },
        accent: {
          DEFAULT: '#0075de',
          dark: '#005bab',
        },
        // legacy aliases used during transition
        sand: '#f8fafc',
        carbon: '#0f172a',
        'rich-gold': '#0f766e',
        'deep-green': '#0f766e',
        pine: '#0f766e',
      },
      fontFamily: {
        display: ['"Tajawal"', 'sans-serif'],
        sans: ['"Tajawal"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sheet: '0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
}
