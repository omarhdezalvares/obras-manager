import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { EMPRESA_GESTION } from "../../lib/roles";

export const empresaRouter = Router();
empresaRouter.use(requireAuth);

const empresaSelect = {
  id: true,
  nombre: true,
  rfc: true,
  direccion: true,
  telefono: true,
  correoContacto: true,
  plan: true,
} as const;

empresaRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: empresaSelect });
    if (!tenant) throw new HttpError(404, "Empresa no encontrada");
    res.json(tenant);
  })
);

const editarEmpresaSchema = z.object({
  nombre: z.string().min(1),
  rfc: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  correoContacto: z.string().email().optional().or(z.literal("")),
});

empresaRouter.patch(
  "/",
  requireRole(...EMPRESA_GESTION),
  asyncHandler(async (req, res) => {
    const body = editarEmpresaSchema.parse(req.body);
    const tenant = await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: {
        nombre: body.nombre,
        rfc: body.rfc || null,
        direccion: body.direccion || null,
        telefono: body.telefono || null,
        correoContacto: body.correoContacto || null,
      },
      select: empresaSelect,
    });
    res.json(tenant);
  })
);
