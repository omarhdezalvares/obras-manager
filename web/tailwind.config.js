/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta tomada del documento de especificacion (seccion de estilos
        // del propio artefacto): azul acero como acento, cobre como color
        // secundario para alertas de campo.
        accent: {
          DEFAULT: "#1E5B8C",
          ink: "#0F3653",
          soft: "#E4EDF3",
        },
        copper: {
          DEFAULT: "#A85A1B",
          soft: "#F3E4D3",
        },
        ok: { DEFAULT: "#276749", soft: "#E4F1EA" },
        warn: { DEFAULT: "#9C6B15", soft: "#F6EBD4" },
        crit: { DEFAULT: "#A63B31", soft: "#F5E2DF" },
        ink: "#182430",
        "ink-soft": "#4B5A66",
      },
    },
  },
  plugins: [],
};
