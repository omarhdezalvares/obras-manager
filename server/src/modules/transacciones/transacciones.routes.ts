import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertObraVisible } from "../../lib/obraScope";
import { writeAuditLog } from "../../lib/audit";
import { TRANSACCION_GESTION, VER_TRANSACCIONES } from "../../lib/roles";
import { esGasto } from "../../lib/finance";

export const transaccionesRouter = Router({ mergeParams: true });
transaccionesRouter.use(requireAuth);

const querySchema = z.object({
  partida_id: z.string().optional(),
  solo_editadas: z.coerce.boolean().optional(),
});

transaccionesRouter.get(
  "/",
  requireRole(...VER_TRANSACCIONES),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const q = querySchema.parse(req.query);

    const transacciones = await prisma.transaccion.findMany({
      where: {
        obraId,
        tenantId: req.user!.tenantId,
        partidaId: q.partida_id,
        ...(q.solo_editadas ? { updatedBy: { not: null } } : {}),
      },
      include: { partida: true, persona: true, asistencia: true, remision: true },
      orderBy: { createdAt: "desc" },
    });

    // Signo/color: partidas de presupuesto en positivo/verde, gastos en
    // negativo/rojo. `persona` ya viene incluida arriba, usada por el
    // frontend para mostrar el nombre en transacciones de tipo asistencia.
    const conSigno = transacciones.map((t) => ({
      ...t,
      esGasto: esGasto(t.tipo),
      montoConSigno: esGasto(t.tipo) ? -Math.abs(t.monto) : Math.abs(t.monto),
    }));
    res.json(conSigno);
  })
);

// Creacion manual de transacciones (seccion 07: "el punto de entrada para
// todo ajuste manual"). Solo Administrador/Finanzas (seccion 06).
const createSchema = z.object({
  partidaId: z.string().min(1),
  tipo: z.enum(["otro_costo", "ajuste_presupuesto", "devolucion"]),
  monto: z.number(),
  personaId: z.string().optional(),
  descripcion: z.string().optional(),
});

transaccionesRouter.post(
  "/",
  requireRole(...TRANSACCION_GESTION),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const body = createSchema.parse(req.body);

    const partida = await prisma.partidaPresupuestal.findFirst({ where: { id: body.partidaId, obraId } });
    if (!partida) throw new HttpError(404, "Partida no encontrada en esta obra");

    const transaccion = await prisma.transaccion.create({
      data: {
        tenantId: req.user!.tenantId,
        obraId,
        partidaId: body.partidaId,
        tipo: body.tipo,
        monto: body.monto,
        personaId: body.personaId,
        registradoPor: req.user!.sub,
        descripcion: body.descripcion,
      },
    });

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "transaccion",
      entidadId: transaccion.id,
      accion: "crear",
      cambios: { despues: body },
    });

    res.status(201).json(transaccion);
  })
);

// Edicion auditada (seccion 05 / 13): solo Administrador/Finanzas, motivo
// obligatorio, el "antes" nunca se pierde porque queda en audit_log.
const updateSchema = z.object({
  monto: z.number().optional(),
  partidaId: z.string().optional(),
  descripcion: z.string().optional(),
  motivoAjuste: z.string().min(1, "El motivo de ajuste es obligatorio para editar una transaccion"),
});

transaccionesRouter.patch(
  "/:transaccionId",
  requireRole(...TRANSACCION_GESTION),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const body = updateSchema.parse(req.body);

    const antes = await prisma.transaccion.findFirst({ where: { id: req.params.transaccionId, obraId } });
    if (!antes) throw new HttpError(404, "Transaccion no encontrada");

    if (body.partidaId) {
      const partida = await prisma.partidaPresupuestal.findFirst({ where: { id: body.partidaId, obraId } });
      if (!partida) throw new HttpError(404, "Partida destino no encontrada en esta obra");
    }

    const { motivoAjuste, ...cambios } = body;

    const transaccion = await prisma.transaccion.update({
      where: { id: req.params.transaccionId },
      data: { ...cambios, motivoAjuste, updatedBy: req.user!.sub },
    });

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "transaccion",
      entidadId: transaccion.id,
      accion: "actualizar",
      cambios: {
        antes: { monto: antes.monto, partidaId: antes.partidaId, descripcion: antes.descripcion },
        despues: cambios,
        motivoAjuste,
      },
    });

    res.json(transaccion);
  })
);
