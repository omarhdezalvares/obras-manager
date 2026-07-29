import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { HERRAMIENTA_GESTION } from "../../lib/roles";
import { visibleObraIds } from "../../lib/obraScope";

export const herramientasRouter = Router();
herramientasRouter.use(requireAuth);

herramientasRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const herramientas = await prisma.herramienta.findMany({
      where: { tenantId: req.user!.tenantId, deletedAt: null },
      orderBy: { codigo: "asc" },
    });
    const conCustodia = await Promise.all(
      herramientas.map(async (h) => {
        const vigente = await prisma.herramientaAsignacion.findFirst({
          where: { herramientaId: h.id, fechaDevolucion: null },
          include: { obra: true, persona: true },
          orderBy: { fechaAsignacion: "desc" },
        });
        return { ...h, asignacionVigente: vigente };
      })
    );
    res.json(conCustodia);
  })
);

// Pantalla "Mis herramientas" (seccion 08 flujo 11 / seccion 11): lo
// asignado a mi nombre, mas lo asignado a obras de las que soy responsable.
herramientasRouter.get(
  "/mias",
  asyncHandler(async (req, res) => {
    if (!req.user!.personaId) {
      res.json([]);
      return;
    }
    const scope = await visibleObraIds(req.user!);
    const obraFilter = scope === "ALL" ? {} : { obraId: { in: scope } };
    const yo = await prisma.persona.findUnique({ where: { id: req.user!.personaId } });

    const asignaciones = await prisma.herramientaAsignacion.findMany({
      where: {
        fechaDevolucion: null,
        OR: [
          { personaId: req.user!.personaId },
          ...(yo ? [{ custodioNombre: { equals: yo.nombreCompleto } }] : []),
          obraFilter,
        ],
      },
      include: { herramienta: true, obra: true, persona: true },
      orderBy: { fechaAsignacion: "desc" },
    });
    res.json(asignaciones);
  })
);

const createSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numeroSerie: z.string().optional(),
});

herramientasRouter.post(
  "/",
  requireRole(...HERRAMIENTA_GESTION),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const herramienta = await prisma.herramienta.create({
      data: { tenantId: req.user!.tenantId, ...body, estado: "disponible" },
    });
    res.status(201).json(herramienta);
  })
);

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numeroSerie: z.string().optional(),
  estado: z.enum(["disponible", "asignada", "mantenimiento", "baja"]).optional(),
});

herramientasRouter.patch(
  "/:id",
  requireRole(...HERRAMIENTA_GESTION),
  asyncHandler(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const herramienta = await prisma.herramienta.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null },
    });
    if (!herramienta) throw new HttpError(404, "Herramienta no encontrada");
    const actualizada = await prisma.herramienta.update({ where: { id: herramienta.id }, data: body });
    res.json(actualizada);
  })
);

// El custodio se captura como nombre libre (en vez de un combo limitado al
// catalogo de Personas registradas): en campo el responsable de una
// herramienta a veces no es una Persona dada de alta en el sistema.
const asignarSchema = z
  .object({
    obraId: z.string().optional(),
    custodioNombre: z.string().min(1).optional(),
    observaciones: z.string().optional(),
  })
  .refine((d) => d.obraId || d.custodioNombre, { message: "Debe indicar una obra y/o el nombre del custodio" });

// Flujo 10 (seccion 08): asignar cierra automaticamente la asignacion
// anterior - una herramienta tiene un unico responsable vigente.
herramientasRouter.post(
  "/:id/asignaciones",
  requireRole(...HERRAMIENTA_GESTION),
  asyncHandler(async (req, res) => {
    const body = asignarSchema.parse(req.body);
    const herramienta = await prisma.herramienta.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null },
    });
    if (!herramienta) throw new HttpError(404, "Herramienta no encontrada");

    const asignacion = await prisma.$transaction(async (tx) => {
      await tx.herramientaAsignacion.updateMany({
        where: { herramientaId: herramienta.id, fechaDevolucion: null },
        data: { fechaDevolucion: new Date() },
      });

      const nueva = await tx.herramientaAsignacion.create({
        data: {
          tenantId: req.user!.tenantId,
          herramientaId: herramienta.id,
          obraId: body.obraId,
          custodioNombre: body.custodioNombre,
          observaciones: body.observaciones,
        },
      });

      await tx.herramienta.update({ where: { id: herramienta.id }, data: { estado: "asignada" } });

      return nueva;
    });

    res.status(201).json(asignacion);
  })
);

herramientasRouter.post(
  "/:id/asignaciones/:asignacionId/devolver",
  requireRole(...HERRAMIENTA_GESTION),
  asyncHandler(async (req, res) => {
    const herramienta = await prisma.herramienta.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!herramienta) throw new HttpError(404, "Herramienta no encontrada");

    await prisma.herramientaAsignacion.update({
      where: { id: req.params.asignacionId },
      data: { fechaDevolucion: new Date() },
    });
    await prisma.herramienta.update({ where: { id: herramienta.id }, data: { estado: "disponible" } });

    res.status(204).send();
  })
);

herramientasRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const herramienta = await prisma.herramienta.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null },
    });
    if (!herramienta) throw new HttpError(404, "Herramienta no encontrada");
    const historial = await prisma.herramientaAsignacion.findMany({
      where: { herramientaId: herramienta.id },
      include: { obra: true, persona: true },
      orderBy: { fechaAsignacion: "desc" },
    });
    res.json({ ...herramienta, historial });
  })
);
