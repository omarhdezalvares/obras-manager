import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { hashRefreshToken, generateRefreshToken, signAccessToken, verifyAccessToken } from "../../lib/jwt";
import { verifyPassword } from "../../lib/password";
import { asyncHandler } from "../../middleware/errorHandler";
import { HttpError, requireAuth } from "../../middleware/auth";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const usuario = await prisma.usuario.findFirst({
      where: { email, activo: true, deletedAt: null },
      include: { rol: true, persona: true, tenant: true },
    });
    if (!usuario) throw new HttpError(401, "Credenciales invalidas");

    const ok = await verifyPassword(password, usuario.passwordHash);
    if (!ok) throw new HttpError(401, "Credenciales invalidas");
    if (!usuario.tenant.activo) throw new HttpError(403, "El tenant de esta cuenta esta suspendido");

    await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoLoginAt: new Date() } });

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

    res.json({
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
    });
  })
);

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

authRouter.post(
  "/refresh",
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
