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
