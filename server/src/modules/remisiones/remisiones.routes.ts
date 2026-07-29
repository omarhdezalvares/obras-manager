import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertObraVisible } from "../../lib/obraScope";
import { REMISION_GESTION } from "../../lib/roles";

export const remisionesRouter = Router({ mergeParams: true });
remisionesRouter.use(requireAuth);

remisionesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const remisiones = await prisma.remision.findMany({
      where: { obraId, tenantId: req.user!.tenantId, deletedAt: null },
      include: { materiales: { include: { material: true } }, partida: true },
      orderBy: { fecha: "desc" },
    });
    res.json(remisiones);
  })
);

const lineaSchema = z.object({
  materialId: z.string().min(1),
  cantidad: z.number().positive(),
  costoUnitario: z.number().nonnegative(),
});

const createSchema = z.object({
  partidaId: z.string().min(1),
  proveedor: z.string().min(1),
  folio: z.string().optional(),
  fecha: z.string().min(1),
  materiales: z.array(lineaSchema).min(1),
});

// Flujo 7 (seccion 08): registrar remision genera transaccion costo_material
// por el total, con evidencia adjuntable por separado via /evidencias.
remisionesRouter.post(
  "/",
  requireRole(...REMISION_GESTION),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const body = createSchema.parse(req.body);

    const partida = await prisma.partidaPresupuestal.findFirst({ where: { id: body.partidaId, obraId } });
    if (!partida) throw new HttpError(404, "Partida no encontrada en esta obra");

    const costoTotal = body.materiales.reduce((acc, m) => acc + m.cantidad * m.costoUnitario, 0);

    const remision = await prisma.$transaction(async (tx) => {
      const nueva = await tx.remision.create({
        data: {
          tenantId: req.user!.tenantId,
          obraId,
          partidaId: body.partidaId,
          proveedor: body.proveedor,
          folio: body.folio,
          fecha: new Date(body.fecha),
          costoTotal,
          registradoPor: req.user!.sub,
        },
      });

      await tx.remisionMaterial.createMany({
        data: body.materiales.map((m) => ({
          remisionId: nueva.id,
          materialId: m.materialId,
          cantidad: m.cantidad,
          costoUnitario: m.costoUnitario,
          costoTotal: m.cantidad * m.costoUnitario,
        })),
      });

      await tx.transaccion.create({
        data: {
          tenantId: req.user!.tenantId,
          obraId,
          partidaId: body.partidaId,
          tipo: "costo_material",
          monto: costoTotal,
          remisionId: nueva.id,
          registradoPor: req.user!.sub,
          descripcion: `Remision de material - proveedor ${body.proveedor}${body.folio ? ` - folio ${body.folio}` : ""}`,
        },
      });

      return nueva;
    });

    res.status(201).json(remision);
  })
);
