import { prisma } from "./prisma";
import { AccessTokenClaims } from "./jwt";
import { TENANT_WIDE_VIEW_ROLES } from "./roles";

// Seccion 13: "Solo los usuarios asignados a una obra (o con rol
// administrativo) pueden verla"; "El Oficial solo ve las obras a las que
// esta explicitamente asignado"; "El Administrador ve todas las obras de su
// tenant, sin excepcion". Gerente/Supervisor ven las obras donde son
// responsables o estan asignados via obra_personas.
export async function visibleObraIds(user: AccessTokenClaims): Promise<string[] | "ALL"> {
  if (TENANT_WIDE_VIEW_ROLES.includes(user.rol as (typeof TENANT_WIDE_VIEW_ROLES)[number])) {
    return "ALL";
  }
  if (!user.personaId) return [];

  const [asignadas, responsable] = await Promise.all([
    prisma.obraPersona.findMany({
      where: { tenantId: user.tenantId, personaId: user.personaId, activo: true },
      select: { obraId: true },
    }),
    prisma.obra.findMany({
      where: { tenantId: user.tenantId, responsableId: user.personaId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  const ids = new Set<string>();
  asignadas.forEach((a) => ids.add(a.obraId));
  responsable.forEach((o) => ids.add(o.id));
  return Array.from(ids);
}

export async function assertObraVisible(user: AccessTokenClaims, obraId: string): Promise<void> {
  const scope = await visibleObraIds(user);
  if (scope === "ALL") return;
  if (!scope.includes(obraId)) {
    const { HttpError } = await import("../middleware/auth");
    throw new HttpError(403, "No tienes acceso a esta obra");
  }
}
