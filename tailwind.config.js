/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f12',
        card: '#16161c',
        border: '#2a2a35',
        accent: '#c8f060',
        'accent-dim': '#a0c040',
        text: '#f0f0f0',
        muted: '#7a7a90',
        protein: '#60d4f0',
        carbs: '#f0c060',
        fats: '#f060a8',
        danger: '#f06060',
        success: '#60f090',
        warning: '#f0c060',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
