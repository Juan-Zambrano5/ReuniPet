import type { Config } from 'tailwindcss';
// Se importa como ESM (no require): el config se carga como módulo nativo
// en algunas rutas del dev server y `require` no existe en ese scope.
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1200px' },
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5B57E8',
          hover: '#4A46D1',
          soft: '#EEF2FF',
          foreground: '#FFFFFF',
        },
        info: {
          bg: '#EBF5FF',
        },
        success: {
          DEFAULT: '#1FAE7A',
          hover: '#189568',
          bg: '#E7F8F2',
          'bg-soft': '#F0FDF4',
          foreground: '#FFFFFF',
        },
        danger: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        destructive: '#EF4444',
        bg: '#F8FAFC',
        card: '#FFFFFF',
        surface: '#F2F3F5',
        muted: '#6B6B6E',
        border: '#E4E4E7',
        text: '#111111',
      },
      borderRadius: {
        DEFAULT: '10px',
        card: '16px',
        control: '10px',
        pill: '9999px',
        lg: '10px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
