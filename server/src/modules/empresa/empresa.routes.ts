import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rateLimit";
import { asyncHandler } from "../../middleware/errorHandler";
import { EMPRESA_GESTION } from "../../lib/roles";
import { COLOR_HEX } from "../../lib/marca";
import { MAX_BYTES, borrar, esKeyDelTenant, infoArchivo, nuevaKey, urlDeSubida, urlsDeLectura } from "../../lib/storage";

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

async function conLogoUrl<T extends { logoKey: string | null }>({ logoKey, ...tenant }: T) {
  const logoUrl = logoKey ? ((await urlsDeLectura([logoKey])).get(logoKey) ?? null) : null;
  return { ...tenant, logoUrl };
}

empresaRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: empresaSelect });
    if (!tenant) throw new HttpError(404, "Empresa no encontrada");
    res.json(await conLogoUrl(tenant));
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
    res.json(await conLogoUrl(tenant));
  })
);

// Logo para encabezados de reportes. Solo PNG/JPEG: pdfkit no dibuja otros formatos.
// Igual que las evidencias: se pide URL firmada, el navegador sube directo y luego se confirma.
const LOGO_TIPOS = ["image/png", "image/jpeg"];

empresaRouter.post(
  "/logo/subida",
  requireRole(...EMPRESA_GESTION),
  rateLimit("upload", 200, 60 * 60 * 1000, (req) => req.user!.sub),
  asyncHandler(async (req, res) => {
    const { tipoMime } = z
      .object({
        tipoMime: z.string().refine((t) => LOGO_TIPOS.includes(t), { message: "El logo debe ser PNG o JPG" }),
        tamanoBytes: z.number().int().positive().max(MAX_BYTES, "El archivo supera el tamano maximo de 15MB"),
      })
      .parse(req.body);
    const objectKey = nuevaKey(req.user!.tenantId, tipoMime);
    res.json({ objectKey, uploadUrl: await urlDeSubida(objectKey) });
  })
);

empresaRouter.post(
  "/logo",
  requireRole(...EMPRESA_GESTION),
  asyncHandler(async (req, res) => {
    const { objectKey } = z.object({ objectKey: z.string().min(1) }).parse(req.body);
    if (!esKeyDelTenant(objectKey, req.user!.tenantId)) throw new HttpError(403, "El archivo no pertenece a tu empresa");
    const info = await infoArchivo(objectKey);
    if (!info) throw new HttpError(400, "El logo no se subio; intenta de nuevo");
    if (!LOGO_TIPOS.includes(info.tipoMime ?? "")) {
      await borrar([objectKey]);
      throw new HttpError(400, "El logo debe ser PNG o JPG");
    }
    const antes = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { logoKey: true } });
    const tenant = await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: { logoKey: objectKey },
      select: empresaSelect,
    });
    if (antes?.logoKey && antes.logoKey !== objectKey) await borrar([antes.logoKey]);
    res.json(await conLogoUrl(tenant));
  })
);
