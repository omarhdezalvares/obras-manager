import crypto from "crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./password";
import { env } from "../env";
import { enviarCorreo } from "./correo";
import { hash } from "./tokenPassword";
import { HttpError } from "../middleware/auth";
import { ALL_ROLES, ROLES } from "./roles";

const MATERIALES_BASE = ["MATERIALES", "HERRAMIENTAS", "SERVICIOS", "IMPUESTOS"];

// "Constructora Pérez S.A." -> "constructora-perez-s-a-3f9c"; el sufijo evita choques entre empresas homonimas.
function slugDe(nombre: string): string {
  const base = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${base || "empresa"}-${crypto.randomBytes(2).toString("hex")}`;
}

// Alta de una empresa nueva con sus roles, catalogo base y su primer Administrador, todo o nada.
export async function crearEmpresa(datos: { empresa: string; email: string; passwordHash: string }) {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { nombre: datos.empresa, slug: slugDe(datos.empresa), plan: "trial" } });
    await tx.rol.createMany({ data: ALL_ROLES.map((nombre) => ({ tenantId: tenant.id, nombre })) });
    await tx.material.createMany({ data: MATERIALES_BASE.map((nombre) => ({ tenantId: tenant.id, nombre })) });
    const rolAdmin = await tx.rol.findUniqueOrThrow({ where: { tenantId_nombre: { tenantId: tenant.id, nombre: ROLES.ADMIN } } });
    return tx.usuario.create({ data: { tenantId: tenant.id, email: datos.email, passwordHash: datos.passwordHash, rolId: rolAdmin.id } });
  });
}

const LINK_INVALIDO = "El link no es valido o ya vencio; registrate de nuevo";

// La empresa no existe hasta que el dueno abre el link del correo: asi no hay altas con correos ficticios.
export async function solicitarRegistro(datos: { empresa: string; email: string; password: string }): Promise<void> {
  await prisma.registroPendiente.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.registroPendiente.create({
    data: {
      empresa: datos.empresa,
      email: datos.email,
      passwordHash: await hashPassword(datos.password),
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const link = `${env.appUrl}/verificar?token=${token}`;
  await enviarCorreo(datos.email, "Confirma tu correo para crear tu cuenta de Bitácora", {
    titulo: "Confirma tu correo",
    parrafos: ["Ya casi está lista la cuenta de tu empresa en Bitácora. Confirma que este correo es tuyo para terminar de crearla."],
    boton: { texto: "Confirmar correo", link },
    nota: "El link vale 24 horas. Si no fuiste tú, ignora este correo y no se creará ninguna cuenta.",
  });
}

// Quema el link (deleteMany evita doble uso simultaneo) y crea la empresa; devuelve el Administrador.
export async function confirmarRegistro(token: string) {
  const fila = await prisma.registroPendiente.findUnique({ where: { tokenHash: hash(token) } });
  if (!fila || fila.expiresAt < new Date()) throw new HttpError(400, LINK_INVALIDO);
  const { count } = await prisma.registroPendiente.deleteMany({ where: { id: fila.id } });
  if (count === 0) throw new HttpError(400, LINK_INVALIDO);
  if (await prisma.usuario.findUnique({ where: { email: fila.email } })) {
    throw new HttpError(409, "Ya existe una cuenta con ese correo; inicia sesión o recupera tu contraseña");
  }
  return crearEmpresa(fila);
}
