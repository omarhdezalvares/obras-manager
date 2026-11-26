import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { requireAuth } from "../../middleware/auth";
import { requireSuperAdmin } from "../../middleware/superAdmin";
import { prisma } from "../../lib/prisma";
import { estadoCuenta } from "../../lib/plan";
import { ROLES } from "../../lib/roles";
import { resumenTablero, tenantsInternos } from "./resumen";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireSuperAdmin);

type UsuarioMin = { email: string; activo: boolean; deletedAt: Date | null; createdAt: Date; ultimoLoginAt: Date | null; rol: { nombre: string } };

// El Administrador activo mas antiguo es el contacto de la empresa.
export function adminEmailDe(usuarios: UsuarioMin[]): string | null {
  const admins = usuarios.filter((u) => u.activo && !u.deletedAt && u.rol.nombre === ROLES.ADMIN).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return admins[0]?.email ?? null;
}

const ultimoAccesoDe = (usuarios: UsuarioMin[]) =>
  usuarios.reduce<Date | null>((max, u) => (u.ultimoLoginAt && (!max || u.ultimoLoginAt > max) ? u.ultimoLoginAt : max), null);

const usuariosSelect = { select: { email: true, activo: true, deletedAt: true, createdAt: true, ultimoLoginAt: true, rol: { select: { nombre: true } } } } as const;

// shortcut: sin paginar ni filtrar en el servidor; con cientos de empresas, paginar aqui.
adminRouter.get(
  "/empresas",
  asyncHandler(async (_req, res) => {
    const internos = await tenantsInternos();
    const tenants = await prisma.tenant.findMany({ where: { id: { notIn: internos } }, include: { usuarios: usuariosSelect }, orderBy: { createdAt: "desc" } });
    res.json({
      ...resumenTablero(tenants),
      empresas: tenants.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        giro: t.giro,
        canal: t.canal,
        plan: t.plan,
        estado: estadoCuenta(t),
        vigenteHasta: t.vigenteHasta,
        metodoPago: t.metodoPago,
        ultimoAcceso: ultimoAccesoDe(t.usuarios),
        adminEmail: adminEmailDe(t.usuarios),
        createdAt: t.createdAt,
      })),
    });
  })
);
