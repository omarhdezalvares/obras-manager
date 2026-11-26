import { env, listaSuperAdmins } from "../env";
import { prisma } from "../lib/prisma";
import { HttpError } from "./auth";
import { asyncHandler } from "./errorHandler";

export { listaSuperAdmins };

export function esSuperAdmin(email: string, lista: string[] = env.superAdminEmails): boolean {
  const e = email.trim().toLowerCase();
  return e !== "" && lista.includes(e);
}

// Despues de requireAuth. El correo sale de la base, no del token; sin acceso responde 404 para no revelar el panel.
export const requireSuperAdmin = asyncHandler(async (req, _res, next) => {
  const u = await prisma.usuario.findUnique({ where: { id: req.user!.sub }, select: { email: true, activo: true, deletedAt: true } });
  if (!u || !u.activo || u.deletedAt || !esSuperAdmin(u.email)) throw new HttpError(404, "No encontrado");
  next();
});
