/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Institutional palette. primary-color (deep navy) replaces the old
        // magenta; secondary-color (Marian teal) is kept as the accent.
        // All existing bg-/text- utility usages follow automatically.
        "primary-color": "#1E2A44",
        "primary-deep": "#141D33",
        "secondary-color": "#058890",
        "text-color": "white",
        "surface": "#F4F6F9",
        "line": "#E3E7EF",
        "muted": "#5B6474",
        // Role-based accents. These map to CSS custom properties that
        // cascade from [data-tbi-family] on the root element.
        "tbi-magenta": "#B8216A",
        "incubatee-teal": "#03888F",
        "accent": "var(--accent)",
        "accent-rgb": "var(--accent-rgb)",
        "accent-light": "var(--accent-light)",
        "accent-muted": "var(--accent-muted)",
      },
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        shell: "0 1px 2px rgba(20, 29, 51, 0.06)",
      },
      // NOTE: banner background lives in src/index.css (.bg-banner-img) so
      // Vite resolves/bundles the image. A url() here is emitted verbatim
      // and 404s under the "/MarianTBI_Monitoring" base.
    },
  },
  plugins: [],
}