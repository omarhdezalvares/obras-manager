import { env } from "../../env";
import { prisma } from "../../lib/prisma";
import { estadoCuenta } from "../../lib/plan";

// Precio de lista mensual sin IVA (landing y /plan).
export const PRECIO_LISTA = { basico: 1290, profesional: 2690, empresa: 5490 } as const;

export type FilaEmpresa = { plan: string; activo: boolean; vigenteHasta: Date | null };
export type Categoria = "pagando" | "prueba" | "gracia" | "solo_lectura" | "suspendida" | "piloto";

export function categoria(t: FilaEmpresa, ahora = new Date()): Categoria {
  if (!t.activo) return "suspendida";
  if (t.plan === "piloto") return "piloto";
  const e = estadoCuenta(t, ahora);
  return e === "activa" ? "pagando" : (e as Exclude<Categoria, "pagando" | "piloto">);
}

export function resumenTablero(filas: FilaEmpresa[], ahora = new Date()) {
  const contadores: Record<Categoria, number> = { pagando: 0, prueba: 0, gracia: 0, solo_lectura: 0, suspendida: 0, piloto: 0 };
  let ingresoMensualEstimado = 0;
  for (const f of filas) {
    const c = categoria(f, ahora);
    contadores[c]++;
    const precio = PRECIO_LISTA[f.plan as keyof typeof PRECIO_LISTA];
    if (precio && (c === "pagando" || c === "gracia")) ingresoMensualEstimado += precio;
  }
  return { contadores, ingresoMensualEstimado };
}

// Empresas de los duenos de Bitacora: tienen algun usuario en SUPERADMIN_EMAILS.
export async function tenantsInternos(): Promise<string[]> {
  if (!env.superAdminEmails.length) return [];
  const us = await prisma.usuario.findMany({ where: { email: { in: env.superAdminEmails, mode: "insensitive" } }, select: { tenantId: true } });
  return [...new Set(us.map((u) => u.tenantId))];
}

export type FilaTendencia = { clave: string; registros: number; compraron: number; conversion: number };
type EmpresaTendencia = { giro: string | null; canal: string | null; plan: string; primerPagoAt: Date | null };

const SIN_DATO = "Sin dato";

function agrupar(filas: EmpresaTendencia[], campo: "giro" | "canal"): FilaTendencia[] {
  const grupos = new Map<string, { registros: number; compraron: number }>();
  for (const f of filas) {
    const g = grupos.get(f[campo] ?? SIN_DATO) ?? { registros: 0, compraron: 0 };
    g.registros++;
    if (f.primerPagoAt) g.compraron++;
    grupos.set(f[campo] ?? SIN_DATO, g);
  }
  // Mas registros primero; en empate "Sin dato" al final y luego por nombre.
  return [...grupos.entries()]
    .map(([clave, g]) => ({ clave, ...g, conversion: Math.round((g.compraron / g.registros) * 100) }))
    .sort((a, b) => b.registros - a.registros || Number(a.clave === SIN_DATO) - Number(b.clave === SIN_DATO) || a.clave.localeCompare(b.clave, "es"));
}

// "Compro" = tiene primerPagoAt; planes cuenta el plan actual de las que compraron.
export function tendencias(filas: EmpresaTendencia[]) {
  const planes = { basico: 0, profesional: 0, empresa: 0 };
  for (const f of filas) if (f.primerPagoAt && f.plan in planes) planes[f.plan as keyof typeof planes]++;
  return { porGiro: agrupar(filas, "giro"), porCanal: agrupar(filas, "canal"), planes };
}
