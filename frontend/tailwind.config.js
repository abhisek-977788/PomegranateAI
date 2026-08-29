/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pomegranate: { 50:'#fef2f2',100:'#fee2e2',500:'#ef4444',700:'#b91c1c',900:'#7f1d1d' },
      },
    },
  },
  plugins: [],
}