/** @type {import('tailwindcss').Config} */
// USA Hockey palette: navy base (slate is remapped to navy tints so every slate-* class
// follows the brand), red for primary actions, white type.
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50:  '#f5f7fb',
          100: '#e8edf5',
          200: '#cfd8e6',
          300: '#b3c0d6',
          400: '#9aa9c4',
          500: '#7587a8',
          600: '#4f6189',
          700: '#2f4470',
          800: '#1a315e',
          900: '#0c2550',
          950: '#041a3a',
        },
        brand: {
          300: '#f4a3ad',
          400: '#ec5a6e',
          500: '#dc2a43',
          600: '#c8102e',
          700: '#a50d26',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
