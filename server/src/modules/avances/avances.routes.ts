import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertObraVisible } from "../../lib/obraScope";
import { ASISTENCIA_AVANCE_OPERATIVO } from "../../lib/roles";
import { startOfDay } from "../../lib/dates";

export const avancesRouter = Router({ mergeParams: true });
avancesRouter.use(requireAuth);

const createSchema = z.object({
  fecha: z.string().min(1),
  descripcion: z.string().min(1),
});

avancesRouter.post(
  "/",
  requireRole(...ASISTENCIA_AVANCE_OPERATIVO),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const body = createSchema.parse(req.body);
    const fecha = startOfDay(body.fecha);

    const avance = await prisma.$transaction(async (tx) => {
      const nuevo = await tx.avance.create({
        data: {
          tenantId: req.user!.tenantId,
          obraId,
          fecha,
          descripcion: body.descripcion,
          registradoPor: req.user!.sub,
        },
      });

      // Flujo 6 (seccion 08): al guardar el avance se consultan las
      // asistencias de esa obra/fecha y se vinculan automaticamente, sin
      // captura manual duplicada.
      const asistenciasDelDia = await tx.asistencia.findMany({ where: { obraId, fecha } });
      if (asistenciasDelDia.length > 0) {
        await tx.avancePersona.createMany({
          data: asistenciasDelDia.map((a) => ({
            avanceId: nuevo.id,
            personaId: a.personaId,
            asistenciaId: a.id,
          })),
        });
      }

      return nuevo;
    });

    res.status(201).json(avance);
  })
);

avancesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const avances = await prisma.avance.findMany({
      where: { obraId, tenantId: req.user!.tenantId, deletedAt: null },
      include: { avancePersonas: { include: { persona: true } } },
      orderBy: { fecha: "desc" },
    });

    const conEvidencias = await Promise.all(
      avances.map(async (a) => {
        const evidencias = await prisma.evidencia.findMany({ where: { entidadTipo: "avance", entidadId: a.id } });
        if (evidencias.length === 0) {
          // Automatizacion "alerta de evidencia faltante" (seccion 09): se
          // expone como bandera para que la UI lo marque como incompleto.
        }
        return { ...a, evidencias, incompleto: evidencias.length === 0 };
      })
    );

    res.json(conEvidencias);
  })
);

avancesRouter.get(
  "/:avanceId",
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const avance = await prisma.avance.findFirst({
      where: { id: req.params.avanceId, obraId, tenantId: req.user!.tenantId },
      include: { avancePersonas: { include: { persona: true } } },
    });
    if (!avance) {
      res.status(404).json({ error: "Avance no encontrado" });
      return;
    }
    const evidencias = await prisma.evidencia.findMany({ where: { entidadTipo: "avance", entidadId: avance.id } });
    res.json({ ...avance, evidencias });
  })
);
