/** @type {import('tailwindcss').Config} */
import animate from "tailwindcss-animate";

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

        // ── shadcn-compatible slots ────────────────────────────────────
        // Every value resolves to a PMIS token declared in src/index.css,
        // so shadcn primitives inherit the institutional palette and the
        // role accent instead of shipping their own default colours.
        // shadcn's colliding "accent" slot is exposed as "surface-hover".
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        // NOTE: "muted" is deliberately NOT remapped. PMIS already owns
        // `muted` as a *text* colour (#5B6474), which would collide with
        // shadcn's `muted` *surface* slot. Only `muted-foreground` is
        // bridged, and it resolves to that same text colour.
        "muted-foreground": "var(--muted)",
        "surface-hover": "var(--surface-hover)",
        "surface-hover-fg": "var(--surface-hover-fg)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Derived from --radius so a single change rescales every shadcn
        // primitive. PMIS favours a restrained radius.
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        shell: "0 1px 2px rgba(20, 29, 51, 0.06)",
        // Reserved for genuinely floating layers (popovers, dialogs,
        // sheets). Deliberately not used on static page sections.
        popover: "0 4px 16px -2px rgba(15, 23, 42, 0.10), 0 2px 6px -2px rgba(15, 23, 42, 0.06)",
        dialog: "0 12px 40px -8px rgba(15, 23, 42, 0.18)",
      },
      // NOTE: banner background lives in src/index.css (.bg-banner-img) so
      // Vite resolves/bundles the image. A url() here is emitted verbatim
      // and 404s under the "/MarianTBI_Monitoring" base.
    },
  },
  plugins: [animate],
}