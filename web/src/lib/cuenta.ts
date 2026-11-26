// Estado de la cuenta que entrega GET /api/facturacion/estado.
export interface EstadoCuenta {
  plan: string;
  estado: "prueba" | "activa" | "gracia" | "solo_lectura" | "suspendida";
  vigenteHasta: string | null;
  finGracia: string | null;
  metodoPago: "tarjeta" | "transferencia" | null;
  tieneSuscripcion: boolean;
  limites: { obras: number | null; usuarios: number | null }; // null = sin limite
  uso: { obras: number; usuarios: number };
  cobroConfigurado: boolean;
}

const DIA_MS = 86_400_000;
const AVISAR_PRUEBA_DIAS = 5;

const ddmm = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" });

export function mensajeCuenta(e: { estado: string; vigenteHasta: string | null; finGracia: string | null }, hoy = new Date()): string | null {
  if (e.estado === "prueba" && e.vigenteHasta) {
    const dias = Math.ceil((new Date(e.vigenteHasta).getTime() - hoy.getTime()) / DIA_MS);
    if (dias > AVISAR_PRUEBA_DIAS) return null;
    return dias <= 1 ? "Te queda 1 día de prueba." : `Te quedan ${dias} días de prueba.`;
  }
  if (e.estado === "gracia" && e.finGracia) return `Tu pago está pendiente. El ${ddmm(e.finGracia)} tu cuenta pasa a solo lectura.`;
  if (e.estado === "solo_lectura") return "Tu cuenta está en solo lectura. Contrata un plan para seguir capturando.";
  return null;
}
