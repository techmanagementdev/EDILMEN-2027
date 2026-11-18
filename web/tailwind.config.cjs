const path = require('node:path');
module.exports = {
  content: [path.join(__dirname, 'index.html'), path.join(__dirname, 'src/**/*.{js,jsx}')],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1E1416', soft: '#5C4A4D', mute: '#7A6B6D' },
        navy: { DEFAULT: '#3A0A0F', 2: '#4F1016', 3: '#5E1219' },
        brand: { DEFAULT: '#7D0C14', dark: '#5E0910', soft: '#F2E4E5' },
        ok: { DEFAULT: '#0E7A55', soft: '#E6F4EE' },
        warn: { DEFAULT: '#A85A00', soft: '#FFF4E3' },
        bad: { DEFAULT: '#B42318', soft: '#FDECEA' },
        line: '#D9D4D4',
        paper: '#ECEBEA',
      },
      fontFamily: { sans: ['"Geist Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'] },
      boxShadow: { card: 'none', lift: '0 12px 32px -14px rgba(30,20,22,.35)' },
    },
  },
  plugins: [],
};
