import fs from "fs";
import path from "path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertObraVisible } from "../../lib/obraScope";
import { resolveDefaultPartida } from "../../lib/defaultPartida";
import { ASISTENCIA_AVANCE_OPERATIVO, ASISTENCIA_EDICION } from "../../lib/roles";
import { writeAuditLog } from "../../lib/audit";
import { env } from "../../env";
import { notify } from "../../lib/notify";
import { startOfDay } from "../../lib/dates";
import { COSTO_TIPOS } from "../../lib/finance";

export const asistenciasRouter = Router({ mergeParams: true });
asistenciasRouter.use(requireAuth);

const registroSchema = z.object({
  personaId: z.string().min(1),
  horaLlegada: z.string().min(1), // "HH:mm", precargada con hora actual pero editable (seccion 08 flujo 3)
  observaciones: z.string().optional(),
  geolocalizacion: z.string().optional(), // "lat,lng" opcional
});

const createSchema = z.object({
  fecha: z.string().min(1),
  registros: z.array(registroSchema).min(1),
});

asistenciasRouter.post(
  "/",
  requireRole(...ASISTENCIA_AVANCE_OPERATIVO),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const body = createSchema.parse(req.body);
    const fecha = startOfDay(body.fecha);

    const partidaManoObraId = await resolveDefaultPartida(obraId, "mano_obra");

    const resultados: Array<{ personaId: string; ok: boolean; motivo?: string; asistenciaId?: string }> = [];

    for (const registro of body.registros) {
      try {
        const asignacion = await prisma.obraPersona.findUnique({
          where: { obraId_personaId: { obraId, personaId: registro.personaId } },
        });
        if (!asignacion || !asignacion.activo) {
          resultados.push({ personaId: registro.personaId, ok: false, motivo: "La persona no esta asignada a esta obra" });
          continue;
        }

        const persona = await prisma.persona.findFirst({
          where: { id: registro.personaId, tenantId: req.user!.tenantId, activo: true },
        });
        if (!persona) {
          resultados.push({ personaId: registro.personaId, ok: false, motivo: "Persona no encontrada o inactiva" });
          continue;
        }

        // Regla de no duplicidad (obra, persona, fecha) - seccion 05/13.
        const existente = await prisma.asistencia.findUnique({
          where: { obraId_personaId_fecha: { obraId, personaId: registro.personaId, fecha } },
        });
        if (existente) {
          resultados.push({ personaId: registro.personaId, ok: false, motivo: "Ya existe una asistencia para esta persona en esta fecha" });
          continue;
        }

        // Flujo 4 (seccion 08): resuelve costo diario aplicable - override de
        // obra_personas.costoDiarioObra si existe, si no el costo base de la persona.
        const costoAplicado = asignacion.costoDiarioObra ?? persona.costoDiario;

        const { asistencia } = await prisma.$transaction(async (tx) => {
          const nuevaAsistencia = await tx.asistencia.create({
            data: {
              tenantId: req.user!.tenantId,
              obraId,
              personaId: registro.personaId,
              fecha,
              horaLlegada: registro.horaLlegada,
              registradoPor: req.user!.sub,
              observaciones: registro.observaciones,
              geolocalizacion: registro.geolocalizacion,
            },
          });

          // No hay paso de aprobacion: la transaccion se genera de inmediato
          // (seccion 08 flujo 4 / seccion 13 reglas de negocio).
          await tx.transaccion.create({
            data: {
              tenantId: req.user!.tenantId,
              obraId,
              partidaId: partidaManoObraId,
              tipo: "costo_mano_obra",
              monto: costoAplicado,
              personaId: registro.personaId,
              asistenciaId: nuevaAsistencia.id,
              registradoPor: req.user!.sub,
              descripcion: `Costo de mano de obra - ${persona.nombreCompleto} - ${body.fecha}`,
            },
          });

          return { asistencia: nuevaAsistencia };
        });

        resultados.push({ personaId: registro.personaId, ok: true, asistenciaId: asistencia.id });
      } catch (err) {
        resultados.push({
          personaId: registro.personaId,
          ok: false,
          motivo: err instanceof Error ? err.message : "Error desconocido",
        });
      }
    }

    // Alerta de sobreconsumo (seccion 09): si la partida de mano de obra
    // quedo >= 90% de su presupuesto tras estos registros, notifica.
    await checkSobreconsumo(req.user!.tenantId, obraId, partidaManoObraId);

    res.status(201).json({ resultados });
  })
);

async function checkSobreconsumo(tenantId: string, obraId: string, partidaId: string): Promise<void> {
  const partida = await prisma.partidaPresupuestal.findUnique({ where: { id: partidaId } });
  if (!partida) return;
  const suma = await prisma.transaccion.aggregate({
    where: { obraId, partidaId, tipo: { in: COSTO_TIPOS } },
    _sum: { monto: true },
  });
  const presupuesto = partida.presupuestoActualizado || partida.presupuestoInicial;
  if (presupuesto <= 0) return;
  const pct = ((suma._sum.monto ?? 0) / presupuesto) * 100;
  if (pct >= 100) {
    await notify({ tenantId, tipo: "sobreconsumo_100", obraId, mensaje: `La partida "${partida.nombre}" supero el 100% de su presupuesto` });
  } else if (pct >= 90) {
    await notify({ tenantId, tipo: "sobreconsumo_90", obraId, mensaje: `La partida "${partida.nombre}" alcanzo el ${pct.toFixed(0)}% de su presupuesto` });
  }
}

const querySchema = z.object({
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  persona_id: z.string().optional(),
});

asistenciasRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const q = querySchema.parse(req.query);

    const asistencias = await prisma.asistencia.findMany({
      where: {
        obraId,
        tenantId: req.user!.tenantId,
        personaId: q.persona_id,
        fecha: {
          gte: q.fecha_desde ? startOfDay(q.fecha_desde) : undefined,
          lte: q.fecha_hasta ? startOfDay(q.fecha_hasta) : undefined,
        },
      },
      include: { persona: true, transaccion: true },
      orderBy: [{ fecha: "desc" }, { horaLlegada: "desc" }],
    });

    res.json(asistencias);
  })
);

async function asistenciaDeObra(req: { params: Record<string, string>; user?: { tenantId: string } }) {
  const asistencia = await prisma.asistencia.findFirst({
    where: { id: req.params.asistenciaId, obraId: req.params.obraId, tenantId: req.user!.tenantId },
    include: { persona: true, transaccion: true },
  });
  if (!asistencia) throw new HttpError(404, "Asistencia no encontrada");
  return asistencia;
}

const editarSchema = z.object({
  fecha: z.string().min(1).optional(),
  horaLlegada: z.string().min(1).optional(),
  observaciones: z.string().optional(),
});

asistenciasRouter.patch(
  "/:asistenciaId",
  requireRole(...ASISTENCIA_EDICION),
  asyncHandler(async (req, res) => {
    await assertObraVisible(req.user!, req.params.obraId);
    const body = editarSchema.parse(req.body);
    const antes = await asistenciaDeObra(req);
    const fecha = body.fecha ? startOfDay(body.fecha) : undefined;

    // Cambiar a una fecha ya ocupada viola (obra, persona, fecha) -> P2002 -> 409.
    const asistencia = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.asistencia.update({
        where: { id: antes.id },
        data: { fecha, horaLlegada: body.horaLlegada, observaciones: body.observaciones },
      });
      if (body.fecha && antes.transaccion) {
        await tx.transaccion.update({
          where: { id: antes.transaccion.id },
          data: { descripcion: `Costo de mano de obra - ${antes.persona.nombreCompleto} - ${body.fecha}` },
        });
      }
      return actualizada;
    });

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "asistencia",
      entidadId: asistencia.id,
      accion: "actualizar",
      cambios: {
        antes: { fecha: antes.fecha, horaLlegada: antes.horaLlegada, observaciones: antes.observaciones },
        despues: body,
      },
    });

    res.json(asistencia);
  })
);

// Eliminar quita tambien su costo de mano de obra, sus evidencias y su
// vinculo con avances (el avance se conserva sin esa persona).
asistenciasRouter.delete(
  "/:asistenciaId",
  requireRole(...ASISTENCIA_EDICION),
  asyncHandler(async (req, res) => {
    await assertObraVisible(req.user!, req.params.obraId);
    const asistencia = await asistenciaDeObra(req);

    const evidencias = await prisma.evidencia.findMany({
      where: { tenantId: req.user!.tenantId, entidadTipo: "asistencia", entidadId: asistencia.id },
    });

    await prisma.$transaction([
      prisma.avancePersona.deleteMany({ where: { asistenciaId: asistencia.id } }),
      prisma.transaccion.deleteMany({ where: { asistenciaId: asistencia.id } }),
      prisma.evidencia.deleteMany({ where: { id: { in: evidencias.map((e) => e.id) } } }),
      prisma.asistencia.delete({ where: { id: asistencia.id } }),
    ]);

    for (const ev of evidencias) {
      if (ev.bucket === "local") fs.unlink(path.join(env.uploadDir, ev.objectKey), () => {});
    }

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "asistencia",
      entidadId: asistencia.id,
      accion: "eliminar",
      cambios: {
        antes: {
          personaId: asistencia.personaId,
          persona: asistencia.persona.nombreCompleto,
          fecha: asistencia.fecha,
          horaLlegada: asistencia.horaLlegada,
          costoEliminado: asistencia.transaccion?.monto ?? 0,
          evidenciasEliminadas: evidencias.length,
        },
      },
    });

    res.status(204).send();
  })
);
