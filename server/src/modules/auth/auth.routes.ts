import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { hashRefreshToken, generateRefreshToken, signAccessToken, verifyAccessToken } from "../../lib/jwt";
import { passwordSegura, verifyPassword } from "../../lib/password";
import { asyncHandler } from "../../middleware/errorHandler";
import { HttpError, requireAuth } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rateLimit";
import { confirmarRegistro, solicitarRegistro } from "../../lib/empresa";
import { enviarLinkPassword, usarTokenPassword } from "../../lib/tokenPassword";

const QUINCE_MIN = 15 * 60 * 1000;

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  rateLimit("login-ip", 50, QUINCE_MIN),
  rateLimit("login", 10, QUINCE_MIN, (req) => `${req.ip}:${String(req.body?.email ?? "").toLowerCase()}`),
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { rol: true, persona: true, tenant: true },
    });
    if (!usuario || !usuario.activo || usuario.deletedAt) throw new HttpError(401, "Credenciales invalidas");

    const ok = await verifyPassword(password, usuario.passwordHash);
    if (!ok) throw new HttpError(401, "Credenciales invalidas");
    if (!usuario.tenant.activo) throw new HttpError(403, "El tenant de esta cuenta esta suspendido");

    res.json(await iniciarSesion(usuario.id));
  })
);

// Emite access + refresh token y la ficha del usuario (respuesta de login y registro).
async function iniciarSesion(usuarioId: string) {
  const usuario = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { ultimoLoginAt: new Date() },
    include: { rol: true, persona: true, tenant: true },
  });

  const accessToken = signAccessToken({
    sub: usuario.id,
    tenantId: usuario.tenantId,
    rol: usuario.rol.nombre,
    personaId: usuario.personaId,
    email: usuario.email,
  });

  const refresh = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { usuarioId: usuario.id, tokenHash: refresh.hash, expiresAt: refresh.expiresAt },
  });

  return {
    accessToken,
    refreshToken: refresh.token,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol.nombre,
      tenantId: usuario.tenantId,
      tenantNombre: usuario.tenant.nombre,
      personaId: usuario.personaId,
      personaNombre: usuario.persona?.nombreCompleto ?? null,
    },
  };
}

const registroSchema = z.object({
  empresa: z.string().trim().min(2, "Escribe el nombre de tu empresa").max(120),
  email: z.string().email(),
  password: passwordSegura,
});

authRouter.post(
  "/registro",
  rateLimit("registro", 5, 60 * 60 * 1000),
  asyncHandler(async (req, res) => {
    const datos = registroSchema.parse(req.body);
    if (await prisma.usuario.findUnique({ where: { email: datos.email } })) {
      throw new HttpError(409, "Ya existe una cuenta con ese correo; inicia sesión o recupera tu contraseña");
    }
    await solicitarRegistro(datos);
    res.status(202).json({ email: datos.email });
  })
);

// Link del correo de registro: crea la empresa y entra.
authRouter.post(
  "/verificar",
  rateLimit("verificar", 20, QUINCE_MIN),
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const usuario = await confirmarRegistro(token);
    res.status(201).json(await iniciarSesion(usuario.id));
  })
);

// Siempre 204, exista o no el correo, para no revelar quien tiene cuenta.
authRouter.post(
  "/olvide",
  rateLimit("olvide-ip", 20, QUINCE_MIN),
  rateLimit("olvide", 3, QUINCE_MIN, (req) => String(req.body?.email ?? "").toLowerCase()),
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (usuario?.activo && !usuario.deletedAt) await enviarLinkPassword(usuario, "recuperar");
    res.status(204).send();
  })
);

authRouter.post(
  "/restablecer",
  rateLimit("restablecer", 20, QUINCE_MIN),
  asyncHandler(async (req, res) => {
    const { token, password } = z.object({ token: z.string().min(1), password: passwordSegura }).parse(req.body);
    await usarTokenPassword(token, password);
    res.status(204).send();
  })
);

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

authRouter.post(
  "/refresh",
  rateLimit("refresh", 60, QUINCE_MIN),
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const hash = hashRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash: hash, revoked: false },
      include: { usuario: { include: { rol: true } } },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new HttpError(401, "Refresh token invalido o expirado");
    }

    // Rotacion: se revoca el usado y se emite uno nuevo.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    const next = generateRefreshToken();
    await prisma.refreshToken.create({
      data: { usuarioId: stored.usuarioId, tokenHash: next.hash, expiresAt: next.expiresAt },
    });

    const accessToken = signAccessToken({
      sub: stored.usuario.id,
      tenantId: stored.usuario.tenantId,
      rol: stored.usuario.rol.nombre,
      personaId: stored.usuario.personaId,
      email: stored.usuario.email,
    });

    res.json({ accessToken, refreshToken: next.token });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const hash = hashRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({ where: { tokenHash: hash }, data: { revoked: true } });
    res.status(204).send();
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const claims = verifyAccessToken(req.headers.authorization!.slice("Bearer ".length));
    const usuario = await prisma.usuario.findUnique({
      where: { id: claims.sub },
      include: { rol: true, persona: true, tenant: true },
    });
    if (!usuario) throw new HttpError(401, "Usuario no encontrado");
    res.json({
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol.nombre,
      tenantId: usuario.tenantId,
      tenantNombre: usuario.tenant.nombre,
      personaId: usuario.personaId,
      personaNombre: usuario.persona?.nombreCompleto ?? null,
    });
  })
);
