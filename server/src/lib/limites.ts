import { HttpError } from "../middleware/auth";
import { prisma } from "./prisma";
import { limitesDe } from "./plan";

// Solo se revisa al crear o reactivar: lo que ya existe nunca se bloquea (p. ej. tras bajar de plan).
const obrasActivas = (tenantId: string) =>
  prisma.obra.count({ where: { tenantId, deletedAt: null, estado: { notIn: ["cerrada", "cancelada"] } } });
const usuariosActivos = (tenantId: string) => prisma.usuario.count({ where: { tenantId, deletedAt: null, activo: true } });

export const OBRA_NO_CUENTA = ["cerrada", "cancelada"];

async function planDe(tenantId: string): Promise<string> {
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { plan: true } });
  return t.plan;
}

export async function uso(tenantId: string): Promise<{ obras: number; usuarios: number }> {
  const [obras, usuarios] = await Promise.all([obrasActivas(tenantId), usuariosActivos(tenantId)]);
  return { obras, usuarios };
}

export async function assertCabeObra(tenantId: string): Promise<void> {
  const max = limitesDe(await planDe(tenantId)).obras;
  if ((await obrasActivas(tenantId)) >= max) throw new HttpError(403, `Tu plan permite ${max} obras activas. Sube de plan para agregar más.`);
}

export async function assertCabeUsuario(tenantId: string): Promise<void> {
  const max = limitesDe(await planDe(tenantId)).usuarios;
  if ((await usuariosActivos(tenantId)) >= max) throw new HttpError(403, `Tu plan permite ${max} usuarios. Sube de plan para agregar más.`);
}
