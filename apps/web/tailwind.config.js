/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#FAF8F5', paper: '#FFFFFF', ink: '#232129', 'ink-muted': '#6B6570', violet: { 50: '#F5F3FF', 100: '#EDE9FE', 600: '#6D28D9', 700: '#5B21B6' },
      },
      fontFamily: { sans: ['Inter Variable', 'sans-serif'], display: ['Source Serif 4 Variable', 'serif'] },
      boxShadow: { card: '0 1px 2px rgba(35, 33, 41, .05), 0 10px 30px rgba(35, 33, 41, .06)', paper: '0 24px 60px rgba(35, 33, 41, .20)' },
    },
  },
  plugins: [],
}
