import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertObraVisible } from "../../lib/obraScope";
import { partidasConSaldo } from "../../lib/finance";
import { writeAuditLog } from "../../lib/audit";
import { PRESUPUESTO_GESTION, VER_PRESUPUESTO } from "../../lib/roles";

export const partidasRouter = Router({ mergeParams: true });
partidasRouter.use(requireAuth);

partidasRouter.get(
  "/",
  requireRole(...VER_PRESUPUESTO),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    res.json(await partidasConSaldo(obraId));
  })
);

const createSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  tipo: z.enum(["general", "mano_obra", "material", "otro"]).default("otro"),
  presupuestoInicial: z.number().nonnegative().default(0),
});

partidasRouter.post(
  "/",
  requireRole(...PRESUPUESTO_GESTION),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const body = createSchema.parse(req.body);

    // Toda partida con presupuesto inicial > 0 genera su transaccion
    // presupuesto_inicial, igual que la partida "General" creada junto con
    // la obra (seccion 08 flujo 1) - de otro modo el libro de transacciones
    // no refleja el presupuesto de partidas dadas de alta despues de la obra.
    const partida = await prisma.$transaction(async (tx) => {
      const nueva = await tx.partidaPresupuestal.create({
        data: {
          tenantId: req.user!.tenantId,
          obraId,
          codigo: body.codigo,
          nombre: body.nombre,
          descripcion: body.descripcion,
          tipo: body.tipo,
          presupuestoInicial: body.presupuestoInicial,
          presupuestoActualizado: body.presupuestoInicial,
        },
      });

      if (body.presupuestoInicial > 0) {
        await tx.transaccion.create({
          data: {
            tenantId: req.user!.tenantId,
            obraId,
            partidaId: nueva.id,
            tipo: "presupuesto_inicial",
            monto: body.presupuestoInicial,
            registradoPor: req.user!.sub,
            descripcion: `Presupuesto inicial de partida "${nueva.nombre}"`,
          },
        });
      }

      return nueva;
    });

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "partida_presupuestal",
      entidadId: partida.id,
      accion: "crear",
      cambios: { despues: body },
    });

    res.status(201).json(partida);
  })
);

const updateSchema = z.object({
  nombre: z.string().optional(),
  descripcion: z.string().optional(),
  presupuestoActualizado: z.number().nonnegative().optional(),
  estado: z.enum(["activa", "cerrada"]).optional(),
  motivo: z.string().min(1, "El motivo es obligatorio para modificar una partida"),
});

partidasRouter.patch(
  "/:partidaId",
  requireRole(...PRESUPUESTO_GESTION),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const body = updateSchema.parse(req.body);

    const antes = await prisma.partidaPresupuestal.findFirst({ where: { id: req.params.partidaId, obraId } });
    if (!antes) throw new HttpError(404, "Partida no encontrada");

    const { motivo, ...cambios } = body;

    const partida = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.partidaPresupuestal.update({
        where: { id: req.params.partidaId },
        data: cambios,
      });

      // Si el presupuesto cambia, se registra tambien como transaccion de
      // ajuste_presupuesto para que el libro de transacciones refleje el cambio.
      if (
        cambios.presupuestoActualizado !== undefined &&
        cambios.presupuestoActualizado !== antes.presupuestoActualizado
      ) {
        const delta = cambios.presupuestoActualizado - antes.presupuestoActualizado;
        await tx.transaccion.create({
          data: {
            tenantId: req.user!.tenantId,
            obraId,
            partidaId: actualizada.id,
            tipo: "ajuste_presupuesto",
            monto: delta,
            registradoPor: req.user!.sub,
            descripcion: `Ajuste de presupuesto de partida "${actualizada.nombre}"`,
            motivoAjuste: motivo,
          },
        });
      }

      return actualizada;
    });

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "partida_presupuestal",
      entidadId: partida.id,
      accion: "actualizar",
      cambios: { antes, despues: cambios, motivo },
    });

    res.json(partida);
  })
);
