import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        surface: '#12121a',
        'surface-2': '#1a1a26',
        border: '#2a2a3a',
        text: '#f0f0f5',
        muted: '#8888a0',
        accent: '#6366f1',
        'accent-hover': '#818cf8',
      },
      borderRadius: {
        DEFAULT: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
