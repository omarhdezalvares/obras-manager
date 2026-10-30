import crypto from "crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./password";
import { ALL_ROLES, ROLES } from "./roles";

const MATERIALES_BASE = ["MATERIALES", "HERRAMIENTAS", "SERVICIOS", "IMPUESTOS"];

// "Constructora Pérez S.A." -> "constructora-perez-s-a-3f9c"; el sufijo evita choques entre empresas homonimas.
function slugDe(nombre: string): string {
  const base = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${base || "empresa"}-${crypto.randomBytes(2).toString("hex")}`;
}

// Alta de una empresa nueva con sus roles, catalogo base y su primer Administrador, todo o nada.
export async function crearEmpresa(datos: { empresa: string; email: string; password: string }) {
  const passwordHash = await hashPassword(datos.password);
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { nombre: datos.empresa, slug: slugDe(datos.empresa), plan: "trial" } });
    await tx.rol.createMany({ data: ALL_ROLES.map((nombre) => ({ tenantId: tenant.id, nombre })) });
    await tx.material.createMany({ data: MATERIALES_BASE.map((nombre) => ({ tenantId: tenant.id, nombre })) });
    const rolAdmin = await tx.rol.findUniqueOrThrow({ where: { tenantId_nombre: { tenantId: tenant.id, nombre: ROLES.ADMIN } } });
    return tx.usuario.create({ data: { tenantId: tenant.id, email: datos.email, passwordHash, rolId: rolAdmin.id } });
  });
}
