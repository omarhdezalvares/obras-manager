import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { REMISION_GESTION } from "../../lib/roles";

export const materialesRouter = Router();
materialesRouter.use(requireAuth);

materialesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const materiales = await prisma.material.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { nombre: "asc" },
    });
    res.json(materiales);
  })
);

const createSchema = z.object({
  nombre: z.string().min(1),
  unidad: z.string().optional(),
  categoria: z.string().optional(),
});

materialesRouter.post(
  "/",
  requireRole(...REMISION_GESTION),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const material = await prisma.material.create({ data: { tenantId: req.user!.tenantId, ...body } });
    res.status(201).json(material);
  })
);
