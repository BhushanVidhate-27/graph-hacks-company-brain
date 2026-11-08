/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#e15c46', // Heron signature vermilion / orange
          dark: '#c44834',
          light: '#ff735c',
        },
        bg: {
          DEFAULT: '#09090b', // professional black base (black-500)
          subtle: '#101013', // black-600
          card: '#101013',
          elevated: '#141417',
          dark: '#101013',
        },
        border: {
          cad: '#282828',
          subtle: '#28282833',
        },
        primary: '#fafafa',
        secondary: '#f0f0f2',
        black: {
          100: '#fafafa',
          200: '#ececee',
          300: '#c9c9cf',
          400: '#8a8a93',
          500: '#09090b',
          600: '#060608',
          700: '#040405',
          800: '#020203',
          900: '#010102',
        },
        orange: {
          100: '#fde8e1',
          200: '#fbd0c4',
          300: '#f6b094',
          400: '#ee765c',
          500: '#e15c46',
          600: '#c2452d',
          700: '#9e3823',
          800: '#782c1b',
          900: '#4a1c12',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
