import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { visibleObraIds, assertObraVisible } from "../../lib/obraScope";
import { resumenFinancieroObra } from "../../lib/finance";
import { writeAuditLog } from "../../lib/audit";
import { OBRA_PERSONA_GESTION, SIN_ACCESO_FINANCIERO } from "../../lib/roles";

export const obrasRouter = Router();
obrasRouter.use(requireAuth);

const ESTADOS = ["planeada", "en_ejecucion", "pausada", "cerrada", "cancelada"] as const;

// Oficial y Gerente de Proyecto no deben ver ningun dato financiero ni de
// presupuesto (decision de negocio posterior a la especificacion original).
function puedeVerFinanciero(rol: string): boolean {
  return !SIN_ACCESO_FINANCIERO.includes(rol as (typeof SIN_ACCESO_FINANCIERO)[number]);
}

obrasRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const scope = await visibleObraIds(req.user!);
    const where = {
      tenantId: req.user!.tenantId,
      deletedAt: null,
      ...(scope === "ALL" ? {} : { id: { in: scope } }),
    };
    const obras = await prisma.obra.findMany({
      where,
      include: { responsable: true, _count: { select: { obraPersonas: true } } },
      orderBy: { createdAt: "desc" },
    });

    const verFinanciero = puedeVerFinanciero(req.user!.rol);
    const resumenes = verFinanciero ? await Promise.all(obras.map((o) => resumenFinancieroObra(o.id))) : null;

    res.json(
      obras.map((o, i) => ({
        id: o.id,
        nombre: o.nombre,
        cliente: o.cliente,
        ubicacion: o.ubicacion,
        estado: o.estado,
        responsable: o.responsable?.nombreCompleto ?? null,
        personasAsignadas: o._count.obraPersonas,
        fechaInicio: o.fechaInicio,
        fechaFinEstimada: o.fechaFinEstimada,
        ...(verFinanciero
          ? {
              presupuestoAutorizado: o.presupuestoAutorizado,
              consumidoTotal: resumenes![i].consumidoTotal,
              porcentajeConsumido: resumenes![i].porcentajeConsumido,
            }
          : {}),
      }))
    );
  })
);

const createObraSchema = z.object({
  nombre: z.string().min(1),
  cliente: z.string().optional(),
  ubicacion: z.string().optional(),
  descripcion: z.string().optional(),
  observaciones: z.string().optional(),
  responsableId: z.string().optional(),
  fechaInicio: z.string().optional(),
  fechaFinEstimada: z.string().optional(),
  presupuestoAutorizado: z.number().nonnegative().default(0),
});

obrasRouter.post(
  "/",
  requireRole(...OBRA_PERSONA_GESTION),
  asyncHandler(async (req, res) => {
    const body = createObraSchema.parse(req.body);

    // Flujo 1 (seccion 08): al crear la obra se genera automaticamente una
    // partida "General" y una transaccion presupuesto_inicial por el monto
    // autorizado, y la obra queda en estado "planeada".
    const obra = await prisma.$transaction(async (tx) => {
      const nueva = await tx.obra.create({
        data: {
          tenantId: req.user!.tenantId,
          nombre: body.nombre,
          cliente: body.cliente,
          ubicacion: body.ubicacion,
          descripcion: body.descripcion,
          observaciones: body.observaciones,
          responsableId: body.responsableId,
          fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
          fechaFinEstimada: body.fechaFinEstimada ? new Date(body.fechaFinEstimada) : null,
          presupuestoAutorizado: body.presupuestoAutorizado,
          estado: "planeada",
        },
      });

      const partidaGeneral = await tx.partidaPresupuestal.create({
        data: {
          tenantId: req.user!.tenantId,
          obraId: nueva.id,
          codigo: "GEN",
          nombre: "General",
          tipo: "general",
          presupuestoInicial: body.presupuestoAutorizado,
          presupuestoActualizado: body.presupuestoAutorizado,
        },
      });

      if (body.presupuestoAutorizado > 0) {
        await tx.transaccion.create({
          data: {
            tenantId: req.user!.tenantId,
            obraId: nueva.id,
            partidaId: partidaGeneral.id,
            tipo: "presupuesto_inicial",
            monto: body.presupuestoAutorizado,
            registradoPor: req.user!.sub,
            descripcion: "Presupuesto autorizado inicial de la obra",
          },
        });
      }

      return nueva;
    });

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "obra",
      entidadId: obra.id,
      accion: "crear",
      cambios: { despues: body },
    });

    res.status(201).json(obra);
  })
);

obrasRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertObraVisible(req.user!, req.params.id);
    const obra = await prisma.obra.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null },
      include: {
        responsable: true,
        obraPersonas: { where: { activo: true }, include: { persona: true } },
        herramientaAsignaciones: { where: { fechaDevolucion: null }, include: { herramienta: true, persona: true } },
      },
    });
    if (!obra) throw new HttpError(404, "Obra no encontrada");

    if (!puedeVerFinanciero(req.user!.rol)) {
      const { presupuestoAutorizado: _presupuesto, ...obraSinPresupuesto } = obra;
      res.json({
        ...obraSinPresupuesto,
        obraPersonas: obra.obraPersonas.map((op) => {
          const { costoDiarioObra: _c, ...opSinCosto } = op;
          const { costoDiario: _pc, ...personaSinCosto } = op.persona;
          return { ...opSinCosto, persona: personaSinCosto };
        }),
      });
      return;
    }

    const financiero = await resumenFinancieroObra(obra.id);

    res.json({
      ...obra,
      financiero,
    });
  })
);

const updateObraSchema = createObraSchema.partial().extend({
  estado: z.enum(ESTADOS).optional(),
});

obrasRouter.patch(
  "/:id",
  requireRole(...OBRA_PERSONA_GESTION),
  asyncHandler(async (req, res) => {
    await assertObraVisible(req.user!, req.params.id);
    const body = updateObraSchema.parse(req.body);
    const antes = await prisma.obra.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!antes) throw new HttpError(404, "Obra no encontrada");

    const obra = await prisma.obra.update({
      where: { id: req.params.id },
      data: {
        ...body,
        fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : undefined,
        fechaFinEstimada: body.fechaFinEstimada ? new Date(body.fechaFinEstimada) : undefined,
      },
    });

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "obra",
      entidadId: obra.id,
      accion: "actualizar",
      cambios: { antes, despues: body },
    });

    res.json(obra);
  })
);

// ---- asignacion de personas a la obra (obra_personas) ----

const asignarPersonaSchema = z.object({
  personaId: z.string().min(1),
  rolEnObra: z.string().optional(),
  costoDiarioObra: z.number().nonnegative().optional(),
});

obrasRouter.post(
  "/:id/personas",
  requireRole(...OBRA_PERSONA_GESTION),
  asyncHandler(async (req, res) => {
    await assertObraVisible(req.user!, req.params.id);
    const body = asignarPersonaSchema.parse(req.body);

    const persona = await prisma.persona.findFirst({
      where: { id: body.personaId, tenantId: req.user!.tenantId, activo: true },
    });
    if (!persona) throw new HttpError(404, "Persona no encontrada");

    const asignacion = await prisma.obraPersona.upsert({
      where: { obraId_personaId: { obraId: req.params.id, personaId: body.personaId } },
      create: {
        tenantId: req.user!.tenantId,
        obraId: req.params.id,
        personaId: body.personaId,
        rolEnObra: body.rolEnObra,
        costoDiarioObra: body.costoDiarioObra,
        activo: true,
      },
      update: { activo: true, rolEnObra: body.rolEnObra, costoDiarioObra: body.costoDiarioObra },
    });

    res.status(201).json(asignacion);
  })
);

obrasRouter.delete(
  "/:id/personas/:personaId",
  requireRole(...OBRA_PERSONA_GESTION),
  asyncHandler(async (req, res) => {
    await assertObraVisible(req.user!, req.params.id);
    await prisma.obraPersona.updateMany({
      where: { obraId: req.params.id, personaId: req.params.personaId },
      data: { activo: false },
    });
    res.status(204).send();
  })
);

obrasRouter.get(
  "/:id/personas",
  asyncHandler(async (req, res) => {
    await assertObraVisible(req.user!, req.params.id);
    const asignaciones = await prisma.obraPersona.findMany({
      where: { obraId: req.params.id, activo: true },
      include: { persona: true },
      orderBy: { fechaAsignacion: "asc" },
    });
    if (!puedeVerFinanciero(req.user!.rol)) {
      res.json(
        asignaciones.map((op) => {
          const { costoDiarioObra: _c, ...opSinCosto } = op;
          const { costoDiario: _pc, ...personaSinCosto } = op.persona;
          return { ...opSinCosto, persona: personaSinCosto };
        })
      );
      return;
    }
    res.json(asignaciones);
  })
);
