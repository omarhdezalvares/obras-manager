import fs from "fs";
import path from "path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { EMPRESA_GESTION } from "../../lib/roles";
import { COLOR_HEX } from "../../lib/marca";
import { upload } from "../../middleware/upload";
import { env } from "../../env";

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
  colorPrimario: true,
  logoKey: true,
} as const;

function conLogoUrl<T extends { logoKey: string | null }>({ logoKey, ...tenant }: T) {
  return { ...tenant, logoUrl: logoKey ? `/uploads/${logoKey}` : null };
}

empresaRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: empresaSelect });
    if (!tenant) throw new HttpError(404, "Empresa no encontrada");
    res.json(conLogoUrl(tenant));
  })
);

const editarEmpresaSchema = z.object({
  nombre: z.string().min(1),
  rfc: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  correoContacto: z.string().email().optional().or(z.literal("")),
  colorPrimario: z.string().regex(COLOR_HEX, "Color invalido, usa #RRGGBB").optional().or(z.literal("")),
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
        colorPrimario: body.colorPrimario || null,
      },
      select: empresaSelect,
    });
    res.json(conLogoUrl(tenant));
  })
);

// Logo para encabezados de reportes. Solo PNG/JPEG: pdfkit no dibuja otros formatos.
empresaRouter.post(
  "/logo",
  requireRole(...EMPRESA_GESTION),
  upload.single("logo"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Falta el archivo del logo");
    if (!["image/png", "image/jpeg"].includes(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      throw new HttpError(400, "El logo debe ser PNG o JPG");
    }
    const antes = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { logoKey: true } });
    const tenant = await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: { logoKey: req.file.filename },
      select: empresaSelect,
    });
    if (antes?.logoKey) fs.unlink(path.join(env.uploadDir, antes.logoKey), () => {});
    res.json(conLogoUrl(tenant));
  })
);
