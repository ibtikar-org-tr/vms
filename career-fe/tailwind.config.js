/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: '#efe8d7',
        carbon: '#1f1f1f',
        'rich-gold': '#dcb557',
        'deep-green': '#214937',
        pine: '#214937',
        ink: '#1f1f1f',
      },
      fontFamily: {
        display: ['"Tajawal"', 'sans-serif'],
        sans: ['"Tajawal"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
