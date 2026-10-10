import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(0 0% 4%)',
        foreground: 'hsl(0 0% 98%)',
        gold: {
          DEFAULT: '#F7E7CE', /* Champagne Puro */
          light: '#FFFFFF',
          dark: '#C5A059',
        },
        border: 'hsl(0 0% 15%)',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      }
    },
  },
  plugins: [],
};
export default config;
