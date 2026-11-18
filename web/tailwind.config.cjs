const path = require('node:path');
module.exports = {
  content: [path.join(__dirname, 'index.html'), path.join(__dirname, 'src/**/*.{js,jsx}')],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0E1B2C', soft: '#4A5A70', mute: '#7A889C' },
        navy: { DEFAULT: '#0B1F3A', 2: '#132C50', 3: '#1B3A66' },
        brand: { DEFAULT: '#1F5EFF', dark: '#1646C2', soft: '#EAF0FF' },
        ok: { DEFAULT: '#0E7A55', soft: '#E6F4EE' },
        warn: { DEFAULT: '#A85A00', soft: '#FFF4E3' },
        bad: { DEFAULT: '#B42318', soft: '#FDECEA' },
        line: '#E3E8F0',
        paper: '#F6F8FB',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(14,27,44,.06), 0 1px 1px rgba(14,27,44,.04)', lift: '0 10px 30px -12px rgba(14,27,44,.25)' },
    },
  },
  plugins: [],
};
