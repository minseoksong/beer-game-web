/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1419',
        panel: '#1a2332',
        panel2: '#232f44',
        accent: '#f4a261',
        accent2: '#e76f51',
        border: '#2c3a52',
        retailer: '#e76f51',
        wholesaler: '#f4a261',
        distributor: '#e9c46a',
        factory: '#2a9d8f'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif']
      }
    }
  },
  plugins: []
};
