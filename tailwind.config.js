/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary-color": "#B9236B",
        "secondary-color": "#058890",
        "text-color": "white",
      },
      backgroundImage: {
        "banner-img": "url('/src/assets/images/MarianTBI_background.png')",
      }
    },
  },
  plugins: [],
}