/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        gold: '#c5a059',
        dark: '#0a0a0a',
      }
    },
  },
  plugins: [],
}
