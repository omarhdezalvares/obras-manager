/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Identidad "concreto y senalizacion": grafito, concreto y naranja de seguridad.
        // accent es el naranja para texto y botones (5:1 sobre blanco); mark, para barras y marcas.
        accent: { DEFAULT: "#B4500C", ink: "#8A3D09", soft: "#FBE9DC", mark: "#E0701F" },
        copper: { DEFAULT: "#B4500C", soft: "#FBE9DC" },
        graphite: { DEFAULT: "#1F2328", soft: "#3A4048" },
        ground: "#F3F3F1",
        line: "#E2E2DE",
        steel: { DEFAULT: "#2F6DB0", soft: "#E3EDF8", ink: "#1F4E82" },
        ok: { DEFAULT: "#1E7A46", soft: "#E3F1E8" },
        warn: { DEFAULT: "#8A5A00", soft: "#FBEFD9", mark: "#C26A00" },
        crit: { DEFAULT: "#B42318", soft: "#FDECEA" },
        ink: "#1C1F23",
        "ink-soft": "#5B6068",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      // Texto secundario minimo de 13px (antes 12px) para lectura en campo.
      fontSize: { xs: ["0.8125rem", { lineHeight: "1.125rem" }] },
    },
  },
  plugins: [],
};
