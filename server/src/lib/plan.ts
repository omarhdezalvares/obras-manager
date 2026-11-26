// Una sola fecha (vigenteHasta) decide el estado de la empresa; se calcula en cada peticion, sin tareas programadas.
export type Plan = "trial" | "basico" | "profesional" | "empresa" | "piloto";
export type EstadoCuenta = "prueba" | "activa" | "gracia" | "solo_lectura" | "suspendida";

export const DIAS_PRUEBA = 14;
export const DIAS_GRACIA = 7;
const DIA_MS = 86_400_000;

const LIMITES: Record<Plan, { obras: number; usuarios: number }> = {
  trial: { obras: 3, usuarios: 10 },
  basico: { obras: 3, usuarios: 10 },
  profesional: { obras: 10, usuarios: 30 },
  empresa: { obras: Infinity, usuarios: Infinity },
  piloto: { obras: Infinity, usuarios: Infinity },
};

export function limitesDe(plan: string): { obras: number; usuarios: number } {
  return LIMITES[plan as Plan] ?? LIMITES.trial;
}

export function finDeGracia(vigenteHasta: Date): Date {
  return new Date(vigenteHasta.getTime() + DIAS_GRACIA * DIA_MS);
}

export function estadoCuenta(t: { plan: string; vigenteHasta: Date | null; activo: boolean }, ahora = new Date()): EstadoCuenta {
  if (!t.activo) return "suspendida";
  if (t.plan === "piloto") return "activa";
  if (!t.vigenteHasta) return "solo_lectura";
  if (ahora <= t.vigenteHasta) return t.plan === "trial" ? "prueba" : "activa";
  if (ahora <= finDeGracia(t.vigenteHasta)) return "gracia";
  return "solo_lectura";
}

export function finDePrueba(desde = new Date()): Date {
  return new Date(desde.getTime() + DIAS_PRUEBA * DIA_MS);
}
