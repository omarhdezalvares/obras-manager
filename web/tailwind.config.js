/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Identidad Bitacora: cuero/tinta como acento de marca (el color del
        // libro de obra), oxido como color secundario para alertas de campo.
        accent: {
          DEFAULT: "#5C4632",
          ink: "#3B2D20",
          soft: "#ECE4DA",
        },
        copper: {
          DEFAULT: "#A8442A",
          soft: "#F1DED7",
        },
        ok: { DEFAULT: "#276749", soft: "#E4F1EA" },
        // warn oscurecido de #9C6B15 (3.9:1 sobre warn-soft) a 5.35:1 (WCAG AA).
        warn: { DEFAULT: "#82570E", soft: "#F6EBD4" },
        crit: { DEFAULT: "#A63B31", soft: "#F5E2DF" },
        ink: "#20211D",
        "ink-soft": "#5C5A52",
      },
      // Texto secundario minimo de 13px (antes 12px) para lectura en campo.
      fontSize: { xs: ["0.8125rem", { lineHeight: "1.125rem" }] },
    },
  },
  plugins: [],
};
