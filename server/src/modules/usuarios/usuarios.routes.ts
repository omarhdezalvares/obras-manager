import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/password";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { USUARIO_GESTION } from "../../lib/roles";

export const usuariosRouter = Router();
usuariosRouter.use(requireAuth, requireRole(...USUARIO_GESTION));

const usuarioSelect = {
  id: true,
  email: true,
  activo: true,
  ultimoLoginAt: true,
  createdAt: true,
  rolId: true,
  personaId: true,
  rol: { select: { nombre: true } },
  persona: { select: { nombreCompleto: true } },
} as const;

function serializar(usuario: {
  id: string;
  email: string;
  activo: boolean;
  ultimoLoginAt: Date | null;
  createdAt: Date;
  rolId: string;
  personaId: string | null;
  rol: { nombre: string };
  persona: { nombreCompleto: string } | null;
}) {
  return {
    id: usuario.id,
    email: usuario.email,
    activo: usuario.activo,
    ultimoLoginAt: usuario.ultimoLoginAt,
    createdAt: usuario.createdAt,
    rolId: usuario.rolId,
    rolNombre: usuario.rol.nombre,
    personaId: usuario.personaId,
    personaNombre: usuario.persona?.nombreCompleto ?? null,
  };
}

async function rolDeTenant(rolId: string, tenantId: string) {
  const rol = await prisma.rol.findFirst({ where: { id: rolId, tenantId } });
  if (!rol) throw new HttpError(400, "El rol indicado no existe en esta empresa");
  return rol;
}

async function personaDeTenant(personaId: string, tenantId: string) {
  const persona = await prisma.persona.findFirst({ where: { id: personaId, tenantId, deletedAt: null } });
  if (!persona) throw new HttpError(400, "La persona indicada no existe en esta empresa");
  return persona;
}

usuariosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const usuarios = await prisma.usuario.findMany({
      where: { tenantId: req.user!.tenantId, deletedAt: null },
      select: usuarioSelect,
      orderBy: { email: "asc" },
    });
    res.json(usuarios.map(serializar));
  })
);

usuariosRouter.get(
  "/roles",
  asyncHandler(async (req, res) => {
    const roles = await prisma.rol.findMany({
      where: { tenantId: req.user!.tenantId },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    });
    res.json(roles);
  })
);

const crearUsuarioSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  rolId: z.string().min(1),
  personaId: z.string().min(1).optional(),
});

usuariosRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = crearUsuarioSchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    await rolDeTenant(body.rolId, tenantId);
    if (body.personaId) await personaDeTenant(body.personaId, tenantId);

    const passwordHash = await hashPassword(body.password);
    const usuario = await prisma.usuario.create({
      data: {
        tenantId,
        email: body.email,
        passwordHash,
        rolId: body.rolId,
        personaId: body.personaId,
      },
      select: usuarioSelect,
    });
    res.status(201).json(serializar(usuario));
  })
);

const editarUsuarioSchema = z.object({
  email: z.string().email().optional(),
  rolId: z.string().min(1).optional(),
  personaId: z.string().min(1).nullable().optional(),
  activo: z.boolean().optional(),
});

usuariosRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const body = editarUsuarioSchema.parse(req.body);

    const existente = await prisma.usuario.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!existente) throw new HttpError(404, "Usuario no encontrado");

    if (body.activo === false && req.params.id === req.user!.sub) {
      throw new HttpError(400, "No puedes desactivar tu propia cuenta");
    }
    if (body.rolId) await rolDeTenant(body.rolId, tenantId);
    if (body.personaId) await personaDeTenant(body.personaId, tenantId);

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data: {
        email: body.email,
        rolId: body.rolId,
        personaId: body.personaId,
        activo: body.activo,
      },
      select: usuarioSelect,
    });
    res.json(serializar(usuario));
  })
);

const passwordSchema = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

usuariosRouter.post(
  "/:id/password",
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const { password } = passwordSchema.parse(req.body);

    const existente = await prisma.usuario.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!existente) throw new HttpError(404, "Usuario no encontrado");

    const passwordHash = await hashPassword(password);
    await prisma.usuario.update({ where: { id: req.params.id }, data: { passwordHash } });
    // Cierra las sesiones activas: un cambio de contrasena obliga a volver a iniciar sesion.
    await prisma.refreshToken.updateMany({ where: { usuarioId: req.params.id, revoked: false }, data: { revoked: true } });
    res.status(204).send();
  })
);
