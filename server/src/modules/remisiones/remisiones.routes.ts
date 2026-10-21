import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertObraVisible } from "../../lib/obraScope";
import { REMISION_GESTION } from "../../lib/roles";
import { writeAuditLog } from "../../lib/audit";

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

function calcularCostoTotal(materiales: z.infer<typeof lineaSchema>[]): number {
  return materiales.reduce((acc, m) => acc + m.cantidad * m.costoUnitario, 0);
}

function descripcionRemision(proveedor: string, folio?: string): string {
  return `Remision de material - proveedor ${proveedor}${folio ? ` - folio ${folio}` : ""}`;
}

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

    const costoTotal = calcularCostoTotal(body.materiales);

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
          descripcion: descripcionRemision(body.proveedor, body.folio),
        },
      });

      return nueva;
    });

    res.status(201).json(remision);
  })
);

const updateSchema = createSchema.extend({
  motivo: z.string().min(1, "El motivo es obligatorio para editar una remision"),
});

// Editar reemplaza las lineas de material y sincroniza la transaccion
// costo_material de la remision (monto, partida) dejando el motivo.
remisionesRouter.patch(
  "/:remisionId",
  requireRole(...REMISION_GESTION),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const body = updateSchema.parse(req.body);

    const antes = await prisma.remision.findFirst({
      where: { id: req.params.remisionId, obraId, tenantId: req.user!.tenantId, deletedAt: null },
      include: { materiales: true },
    });
    if (!antes) throw new HttpError(404, "Remision no encontrada");

    const partida = await prisma.partidaPresupuestal.findFirst({ where: { id: body.partidaId, obraId } });
    if (!partida) throw new HttpError(404, "Partida no encontrada en esta obra");

    const costoTotal = calcularCostoTotal(body.materiales);

    const remision = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.remision.update({
        where: { id: antes.id },
        data: {
          partidaId: body.partidaId,
          proveedor: body.proveedor,
          folio: body.folio ?? null,
          fecha: new Date(body.fecha),
          costoTotal,
        },
      });

      await tx.remisionMaterial.deleteMany({ where: { remisionId: antes.id } });
      await tx.remisionMaterial.createMany({
        data: body.materiales.map((m) => ({
          remisionId: antes.id,
          materialId: m.materialId,
          cantidad: m.cantidad,
          costoUnitario: m.costoUnitario,
          costoTotal: m.cantidad * m.costoUnitario,
        })),
      });

      await tx.transaccion.updateMany({
        where: { remisionId: antes.id, tipo: "costo_material" },
        data: {
          monto: costoTotal,
          partidaId: body.partidaId,
          descripcion: descripcionRemision(body.proveedor, body.folio),
          motivoAjuste: body.motivo,
          updatedBy: req.user!.sub,
        },
      });

      return actualizada;
    });

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "remision",
      entidadId: remision.id,
      accion: "actualizar",
      cambios: { antes, despues: body, motivo: body.motivo },
    });

    res.json(remision);
  })
);
