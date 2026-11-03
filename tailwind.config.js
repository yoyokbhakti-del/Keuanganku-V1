/** @type {import('tailwindcss').Config} */
const c = (n) => `rgb(var(--${n}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: ['./index.html', './app.js'],
  theme: {
    extend: {
      colors: {
        ios: {
          bg: c('bg'),
          card: c('card'),
          fill: c('fill'),
          label: c('label'),
          secondary: c('secondary'),
          sep: c('sep'),
          blue: c('blue'),
          green: c('green'),
          red: c('red'),
          orange: c('orange'),
          yellow: c('yellow'),
          purple: c('purple'),
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Helvetica Neue"', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
