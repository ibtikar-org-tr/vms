/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#15202b',
        muted: '#5b6b7c',
        soft: '#f3f5f7',
        line: '#d8dee6',
        brand: {
          DEFAULT: '#0b6b63',
          dark: '#085750',
          light: '#e6f3f1',
          ink: '#0f3f3b',
        },
        accent: {
          DEFAULT: '#0b5f9a',
          dark: '#084872',
        },
        sand: '#f3f5f7',
        carbon: '#15202b',
        'rich-gold': '#0b6b63',
        'deep-green': '#0b6b63',
        pine: '#0b6b63',
      },
      fontFamily: {
        display: ['"Tajawal"', 'sans-serif'],
        sans: ['"Tajawal"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sheet: '0 1px 0 rgba(21, 32, 43, 0.04)',
      },
      borderRadius: {
        xl: '0.5rem',
        '2xl': '0.625rem',
        '3xl': '0.75rem',
      },
    },
  },
  plugins: [],
}
