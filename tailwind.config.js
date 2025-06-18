/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'focus:border-black',
    'focus:ring-black',
  ],
  theme: {
    extend: {
      colors: {
        civicBlue: '#1e3a8a',
        civicGray: '#f5f6f8',
        civicText: '#1f2937',
        civicBorder: '#d1d5db',
        actionBlue: '#2563eb',
        actionBlueHover: '#1d4ed8',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        'layout': '2rem',
        'sidebar': '20rem',
      },
      borderRadius: {
        layout: '1.25rem',
      },
      boxShadow: {
        card: '0 2px 6px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
