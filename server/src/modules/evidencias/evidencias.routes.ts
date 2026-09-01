import fs from "fs";
import path from "path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { upload } from "../../middleware/upload";
import { assertObraVisible } from "../../lib/obraScope";
import { writeAuditLog } from "../../lib/audit";
import { ROLES } from "../../lib/roles";
import { env } from "../../env";

export const evidenciasRouter = Router();
evidenciasRouter.use(requireAuth);

const ENTIDADES = ["asistencia", "avance", "remision", "herramienta"] as const;

const metaSchema = z.object({
  entidadTipo: z.enum(ENTIDADES),
  entidadId: z.string().min(1),
});

// Version de test: sube directo al servidor (disco local) en una sola
// llamada multipart, en vez del patron URL-prefirmada-a-S3 de produccion
// descrito en la seccion 03. El modelo de datos (bucket/objectKey) es el
// mismo, asi que migrar a S3 despues es solo cambiar esta ruta.
evidenciasRouter.post(
  "/",
  upload.single("archivo"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, "Falta el archivo 'archivo'");
    const { entidadTipo, entidadId } = metaSchema.parse(req.body);

    if (entidadTipo !== "herramienta") {
      // Para asistencia/avance/remision, la entidad vive dentro de una obra;
      // se valida acceso a traves de su obra cuando aplica.
      const obraId = await resolverObraDeEntidad(entidadTipo, entidadId);
      if (obraId) await assertObraVisible(req.user!, obraId);
    }

    const evidencia = await prisma.evidencia.create({
      data: {
        tenantId: req.user!.tenantId,
        entidadTipo,
        entidadId,
        bucket: "local",
        objectKey: req.file.filename,
        tipoMime: req.file.mimetype,
        tamanoBytes: req.file.size,
        subidaPor: req.user!.sub,
      },
    });

    res.status(201).json({ ...evidencia, url: `/uploads/${req.file.filename}` });
  })
);

async function resolverObraDeEntidad(entidadTipo: string, entidadId: string): Promise<string | null> {
  if (entidadTipo === "asistencia") {
    const a = await prisma.asistencia.findUnique({ where: { id: entidadId } });
    return a?.obraId ?? null;
  }
  if (entidadTipo === "avance") {
    const a = await prisma.avance.findUnique({ where: { id: entidadId } });
    return a?.obraId ?? null;
  }
  if (entidadTipo === "remision") {
    const r = await prisma.remision.findUnique({ where: { id: entidadId } });
    return r?.obraId ?? null;
  }
  return null;
}

const listQuerySchema = z.object({
  entidadTipo: z.enum(ENTIDADES),
  entidadId: z.string().min(1),
});

evidenciasRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const evidencias = await prisma.evidencia.findMany({
      where: { tenantId: req.user!.tenantId, entidadTipo: q.entidadTipo, entidadId: q.entidadId },
      orderBy: { createdAt: "desc" },
    });
    res.json(evidencias.map((e) => ({ ...e, url: `/uploads/${e.objectKey}` })));
  })
);

// Permite corregir un registro equivocado (foto borrosa, entidad incorrecta,
// etc). El Oficial solo puede borrar lo que el mismo subio; el resto de los
// roles operativos (Administrador/Gerente/Supervisor/Finanzas) puede borrar
// cualquier evidencia dentro de su alcance de obras. Solo lectura nunca borra.
evidenciasRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const evidencia = await prisma.evidencia.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!evidencia) throw new HttpError(404, "Evidencia no encontrada");

    if (evidencia.entidadTipo !== "herramienta") {
      const obraId = await resolverObraDeEntidad(evidencia.entidadTipo, evidencia.entidadId);
      if (obraId) await assertObraVisible(req.user!, obraId);
    }

    const rol = req.user!.rol;
    const esPropia = evidencia.subidaPor === req.user!.sub;
    if (rol === ROLES.LECTURA) throw new HttpError(403, "El rol Solo lectura no puede eliminar evidencias");
    if (rol === ROLES.OFICIAL && !esPropia) throw new HttpError(403, "Solo puedes eliminar evidencias que tu mismo subiste");

    await prisma.evidencia.delete({ where: { id: evidencia.id } });
    if (evidencia.bucket === "local") {
      fs.unlink(path.join(env.uploadDir, evidencia.objectKey), () => {});
    }

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "evidencia",
      entidadId: evidencia.id,
      accion: "eliminar",
      cambios: { entidadTipo: evidencia.entidadTipo, entidadId: evidencia.entidadId, objectKey: evidencia.objectKey },
    });

    res.status(204).send();
  })
);
