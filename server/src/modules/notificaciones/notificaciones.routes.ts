import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { visibleObraIds } from "../../lib/obraScope";

export const notificacionesRouter = Router();
notificacionesRouter.use(requireAuth);

const DIAS_SIN_ACTIVIDAD = 5;

// Combina notificaciones ya persistidas (sobreconsumo, generadas al vuelo en
// asistencias.routes.ts) con dos chequeos calculados en el momento: obra sin
// actividad y avances sin evidencia (seccion 09).
notificacionesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const scope = await visibleObraIds(req.user!);
    const obraFilter = scope === "ALL" ? {} : { id: { in: scope } };

    const guardadas = await prisma.notificacion.findMany({
      where: { tenantId: req.user!.tenantId, ...(scope === "ALL" ? {} : { obraId: { in: scope } }) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const obrasActivas = await prisma.obra.findMany({
      where: { tenantId: req.user!.tenantId, estado: "en_ejecucion", deletedAt: null, ...obraFilter },
    });

    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_SIN_ACTIVIDAD);

    const sinActividad: Array<{ obraId: string; mensaje: string }> = [];
    for (const obra of obrasActivas) {
      const ultima = await prisma.asistencia.findFirst({ where: { obraId: obra.id }, orderBy: { fecha: "desc" } });
      if (!ultima || ultima.fecha < limite) {
        sinActividad.push({
          obraId: obra.id,
          mensaje: `La obra "${obra.nombre}" no tiene asistencias registradas en los ultimos ${DIAS_SIN_ACTIVIDAD} dias habiles`,
        });
      }
    }

    const avancesSinEvidencia = await prisma.avance.findMany({
      where: { obraId: obraFilter.id, tenantId: req.user!.tenantId, deletedAt: null },
      include: { obra: true },
      orderBy: { fecha: "desc" },
      take: 100,
    });
    const incompletos: Array<{ obraId: string; mensaje: string }> = [];
    for (const avance of avancesSinEvidencia) {
      const count = await prisma.evidencia.count({ where: { entidadTipo: "avance", entidadId: avance.id } });
      if (count === 0) {
        incompletos.push({
          obraId: avance.obraId,
          mensaje: `Evidencia del ${avance.fecha.toISOString().slice(0, 10)} en "${avance.obra.nombre}" sin fotos adjuntas`,
        });
      }
    }

    res.json({
      guardadas,
      sinActividad,
      avancesIncompletos: incompletos.slice(0, 20),
    });
  })
);
