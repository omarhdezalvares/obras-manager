import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { OBRA_PERSONA_GESTION, ROLES, SIN_ACCESO_FINANCIERO } from "../../lib/roles";

export const personasRouter = Router();
personasRouter.use(requireAuth);

function puedeVerFinanciero(rol: string): boolean {
  return !SIN_ACCESO_FINANCIERO.includes(rol as (typeof SIN_ACCESO_FINANCIERO)[number]);
}

function sinCosto<T extends { costoDiario: number }>(persona: T): Omit<T, "costoDiario"> {
  const { costoDiario: _costo, ...resto } = persona;
  return resto;
}

personasRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    // Personas es un catalogo de tenant; el Oficial solo puede ver/editar su
    // propio perfil (seccion 06: Personas -> Oficial = "Propio (perfil)").
    if (req.user!.rol === ROLES.OFICIAL) {
      const propia = req.user!.personaId
        ? await prisma.persona.findMany({ where: { id: req.user!.personaId } })
        : [];
      res.json(propia.map(sinCosto));
      return;
    }
    const personas = await prisma.persona.findMany({
      where: { tenantId: req.user!.tenantId, deletedAt: null },
      orderBy: { nombreCompleto: "asc" },
    });
    res.json(puedeVerFinanciero(req.user!.rol) ? personas : personas.map(sinCosto));
  })
);

const createPersonaSchema = z.object({
  nombreCompleto: z.string().min(1),
  telefono: z.string().optional(),
  puesto: z.string().optional(),
  tipoTrabajador: z.string().optional(),
  costoDiario: z.number().nonnegative().default(0),
});

personasRouter.post(
  "/",
  requireRole(...OBRA_PERSONA_GESTION),
  asyncHandler(async (req, res) => {
    const body = createPersonaSchema.parse(req.body);
    const persona = await prisma.persona.create({
      data: { tenantId: req.user!.tenantId, ...body },
    });
    res.status(201).json(persona);
  })
);

personasRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user!.rol === ROLES.OFICIAL && req.user!.personaId !== req.params.id) {
      throw new HttpError(403, "Solo puedes consultar tu propio perfil");
    }
    const persona = await prisma.persona.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId, deletedAt: null },
      include: { obraPersonas: { where: { activo: true }, include: { obra: true } } },
    });
    if (!persona) throw new HttpError(404, "Persona no encontrada");
    res.json(puedeVerFinanciero(req.user!.rol) ? persona : sinCosto(persona));
  })
);

const updatePersonaSchema = createPersonaSchema.partial().extend({ activo: z.boolean().optional() });

personasRouter.patch(
  "/:id",
  requireRole(...OBRA_PERSONA_GESTION),
  asyncHandler(async (req, res) => {
    const body = updatePersonaSchema.parse(req.body);
    const persona = await prisma.persona.update({ where: { id: req.params.id }, data: body });
    res.json(persona);
  })
);
