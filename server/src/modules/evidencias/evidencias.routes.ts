import { Router, Request } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, HttpError } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rateLimit";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertObraVisible } from "../../lib/obraScope";
import { writeAuditLog } from "../../lib/audit";
import { ROLES } from "../../lib/roles";
import { EXTENSION_POR_MIME, MAX_BYTES, borrar, esKeyDelTenant, infoArchivo, nuevaKey, urlDeSubida, urlsDeLectura } from "../../lib/storage";

export const evidenciasRouter = Router();
evidenciasRouter.use(requireAuth);

const ENTIDADES = ["asistencia", "avance", "remision", "herramienta"] as const;

const metaSchema = z.object({
  entidadTipo: z.enum(ENTIDADES),
  entidadId: z.string().min(1),
});

const TIPOS_TEXTO = "JPG, PNG, WEBP, HEIC o PDF";
const subidaSchema = metaSchema.extend({
  tipoMime: z.string().refine((t) => t in EXTENSION_POR_MIME, { message: `Tipo de archivo no permitido. Usa ${TIPOS_TEXTO}` }),
  tamanoBytes: z.number().int().positive().max(MAX_BYTES, "El archivo supera el tamano maximo de 15MB"),
});

async function assertAccesoEntidad(req: Request, entidadTipo: string, entidadId: string): Promise<void> {
  if (entidadTipo === "herramienta") return;
  // Para asistencia/avance/remision, la entidad vive dentro de una obra;
  // se valida acceso a traves de su obra cuando aplica.
  const obraId = await resolverObraDeEntidad(entidadTipo, entidadId);
  if (obraId) await assertObraVisible(req.user!, obraId);
}

// Paso 1: el navegador pide permiso y recibe una URL firmada para subir directo al bucket.
evidenciasRouter.post(
  "/subida",
  rateLimit("upload", 200, 60 * 60 * 1000, (req) => req.user!.sub),
  asyncHandler(async (req, res) => {
    const { entidadTipo, entidadId, tipoMime } = subidaSchema.parse(req.body);
    await assertAccesoEntidad(req, entidadTipo, entidadId);
    const objectKey = nuevaKey(req.user!.tenantId, tipoMime);
    res.json({ objectKey, uploadUrl: await urlDeSubida(objectKey) });
  })
);

// Paso 2: ya subido el archivo, se registra la evidencia con el tipo y tamano que reporta el bucket.
evidenciasRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { entidadTipo, entidadId, objectKey } = metaSchema.extend({ objectKey: z.string().min(1) }).parse(req.body);
    await assertAccesoEntidad(req, entidadTipo, entidadId);
    if (!esKeyDelTenant(objectKey, req.user!.tenantId)) throw new HttpError(403, "El archivo no pertenece a tu empresa");
    const info = await infoArchivo(objectKey);
    if (!info) throw new HttpError(400, "El archivo no se subio; intenta de nuevo");

    const evidencia = await prisma.evidencia.create({
      data: {
        tenantId: req.user!.tenantId,
        entidadTipo,
        entidadId,
        bucket: "supabase",
        objectKey,
        tipoMime: info.tipoMime,
        tamanoBytes: info.tamanoBytes,
        subidaPor: req.user!.sub,
      },
    });

    const urls = await urlsDeLectura([objectKey]);
    res.status(201).json({ ...evidencia, url: urls.get(objectKey) ?? null });
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
    const urls = await urlsDeLectura(evidencias.map((e) => e.objectKey));
    res.json(evidencias.map((e) => ({ ...e, url: urls.get(e.objectKey) ?? null })));
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

    await assertAccesoEntidad(req, evidencia.entidadTipo, evidencia.entidadId);

    const rol = req.user!.rol;
    const esPropia = evidencia.subidaPor === req.user!.sub;
    if (rol === ROLES.LECTURA) throw new HttpError(403, "El rol Solo lectura no puede eliminar evidencias");
    if (rol === ROLES.OFICIAL && !esPropia) throw new HttpError(403, "Solo puedes eliminar evidencias que tu mismo subiste");

    await prisma.evidencia.delete({ where: { id: evidencia.id } });
    await borrar([evidencia.objectKey]);

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
