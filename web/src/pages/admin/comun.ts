// Etiquetas compartidas por las pantallas del panel de super admin.
export const NOMBRE_PLAN: Record<string, string> = { trial: "Prueba gratis", piloto: "Piloto", basico: "Básico", profesional: "Profesional", empresa: "Empresa" };

export const ESTADO: Record<string, { texto: string; tono: "ok" | "warn" | "crit" | "info" }> = {
  prueba: { texto: "En prueba", tono: "info" },
  activa: { texto: "Al corriente", tono: "ok" },
  gracia: { texto: "Pago pendiente", tono: "warn" },
  solo_lectura: { texto: "Solo lectura", tono: "crit" },
  suspendida: { texto: "Suspendida", tono: "crit" },
};

export const METODO: Record<string, string> = { tarjeta: "Tarjeta", transferencia: "SPEI", manual: "Manual" };

export const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—");

export const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`;
