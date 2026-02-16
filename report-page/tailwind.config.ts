import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      maxWidth: {
        report: '1440px',
        content: '5xl',
      },
      colors: {
        brand: '#4c67ff',
        verified: '#10b981',
        inferred: '#f59e0b',
        // Keep legacy report colors for privacy page, etc.
        report: {
          bg: '#fefefe',
          text: '#1a1a1a',
          heading: '#0f0f0f',
          muted: '#6b7280',
          link: '#4338ca',
          'link-hover': '#3730a3',
          border: '#e5e7eb',
          card: '#f9fafb',
          'badge-green': '#dcfce7',
          'badge-yellow': '#fef9c3',
          'badge-red': '#fee2e2',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
