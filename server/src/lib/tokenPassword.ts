import crypto from "crypto";
import { prisma } from "./prisma";
import { env } from "../env";
import { hashPassword } from "./password";
import { enviarCorreo } from "./correo";
import { HttpError } from "../middleware/auth";

const HORA = 60 * 60 * 1000;
export const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const PLANTILLAS = {
  recuperar: {
    vigenciaMs: HORA,
    asunto: "Restablece tu contraseña de Bitácora",
    cuerpo: "Recibimos una solicitud para restablecer tu contraseña. El link vale 1 hora; si no fuiste tú, ignora este correo.",
    boton: "Restablecer contraseña",
  },
  invitar: {
    vigenciaMs: 7 * 24 * HORA,
    asunto: "Te invitaron a Bitácora",
    cuerpo: "Te dieron acceso a Bitácora. Define tu contraseña para entrar; el link vale 7 días.",
    boton: "Definir contraseña",
  },
};

// Solo se guarda el hash: quien lea la BD no puede usar los links pendientes.
export async function enviarLinkPassword(usuario: { id: string; email: string }, tipo: keyof typeof PLANTILLAS): Promise<void> {
  const p = PLANTILLAS[tipo];
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.tokenPassword.create({
    data: { usuarioId: usuario.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + p.vigenciaMs) },
  });
  const link = `${env.appUrl}/restablecer?token=${token}`;
  await enviarCorreo(
    usuario.email,
    p.asunto,
    `<p>${p.cuerpo}</p><p><a href="${link}">${p.boton}</a></p><p style="color:#666;font-size:12px">${link}</p>`
  );
}

// Define la contrasena con un link valido y lo quema; cierra las sesiones abiertas.
export async function usarTokenPassword(token: string, password: string): Promise<void> {
  const fila = await prisma.tokenPassword.findUnique({ where: { tokenHash: hash(token) }, include: { usuario: true } });
  if (!fila || fila.usadoAt || fila.expiresAt < new Date() || !fila.usuario.activo || fila.usuario.deletedAt) {
    throw new HttpError(400, "El link no es valido o ya vencio; pide uno nuevo");
  }
  // updateMany con usadoAt null evita que dos peticiones simultaneas usen el mismo link.
  const { count } = await prisma.tokenPassword.updateMany({ where: { id: fila.id, usadoAt: null }, data: { usadoAt: new Date() } });
  if (count === 0) throw new HttpError(400, "El link no es valido o ya vencio; pide uno nuevo");
  await prisma.usuario.update({ where: { id: fila.usuarioId }, data: { passwordHash: await hashPassword(password) } });
  await prisma.refreshToken.updateMany({ where: { usuarioId: fila.usuarioId, revoked: false }, data: { revoked: true } });
}
