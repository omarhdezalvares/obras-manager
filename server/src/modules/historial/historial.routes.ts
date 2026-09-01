import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";

export const historialRouter = Router();
historialRouter.use(requireAuth);

// Pantalla "Historial basico" (seccion 11): linea de tiempo de mis ultimas
// asistencias y avances, solo lectura, para confirmar "si quedo guardado".
historialRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user!.personaId) {
      res.json({ asistencias: [], avances: [] });
      return;
    }

    const [asistencias, avances] = await Promise.all([
      prisma.asistencia.findMany({
        where: { tenantId: req.user!.tenantId, personaId: req.user!.personaId },
        include: { obra: true, transaccion: true },
        orderBy: { fecha: "desc" },
        take: 20,
      }),
      // Por "registradoPor" (quien la escribio), no por vinculo de asistencia:
      // ese vinculo se recalcula si la fecha de la evidencia se edita despues
      // y podria dejar de incluir a quien la registro originalmente.
      prisma.avance.findMany({
        where: { tenantId: req.user!.tenantId, registradoPor: req.user!.sub, deletedAt: null },
        include: { obra: true },
        orderBy: { fecha: "desc" },
        take: 20,
      }),
    ]);

    res.json({ asistencias, avances });
  })
);
