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

const ACCION: Record<string, string> = {
  pago_manual: "Pago manual",
  cambiar_plan: "Cambio de plan",
  suspender: "Suspendida",
  reactivar: "Reactivada",
  actualizar: "Datos corregidos",
};

// El webhook de Stripe tambien registra "actualizar": se distingue por quien lo hizo.
export const etiquetaHistorial = (h: { accion: string; quien: string }) => (h.quien === "stripe" ? "Pago en Stripe" : (ACCION[h.accion] ?? h.accion));

export const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`;
