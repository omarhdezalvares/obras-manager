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
        warn: { DEFAULT: "#9C6B15", soft: "#F6EBD4" },
        crit: { DEFAULT: "#A63B31", soft: "#F5E2DF" },
        ink: "#20211D",
        "ink-soft": "#5C5A52",
      },
    },
  },
  plugins: [],
};
