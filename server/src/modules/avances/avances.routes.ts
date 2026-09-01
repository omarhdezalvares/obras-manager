import fs from "fs";
import path from "path";
import { Router } from "express";
import archiver from "archiver";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertObraVisible } from "../../lib/obraScope";
import { ASISTENCIA_AVANCE_OPERATIVO, ROLES } from "../../lib/roles";
import { startOfDay } from "../../lib/dates";
import { generarReporteAvancesPdf } from "../../lib/avancesPdf";
import { env } from "../../env";
import { writeAuditLog } from "../../lib/audit";

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

const reportePdfQuerySchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

// Reporte fotografico de avances pensado para enviarse al cliente (seccion
// "Evidencias" de la obra): solo el Administrador lo genera. Se registra
// aparte de "/:avanceId" (arriba en el archivo, no abajo) porque de otro
// modo Express interpretaria "reporte-pdf" como un :avanceId literal.
avancesRouter.get(
  "/reporte-pdf",
  requireRole(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const { desde, hasta } = reportePdfQuerySchema.parse(req.query);

    const obra = await prisma.obra.findFirst({
      where: { id: obraId, tenantId: req.user!.tenantId, deletedAt: null },
      include: { responsable: true },
    });
    if (!obra) throw new HttpError(404, "Obra no encontrada");

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { nombre: true, direccion: true, telefono: true, correoContacto: true },
    });
    if (!tenant) throw new HttpError(404, "Empresa no encontrada");

    const avances = await prisma.avance.findMany({
      where: {
        obraId,
        tenantId: req.user!.tenantId,
        deletedAt: null,
        fecha: { gte: desde ? startOfDay(desde) : undefined, lte: hasta ? startOfDay(hasta) : undefined },
      },
      include: { avancePersonas: { include: { persona: true } } },
      orderBy: { fecha: "asc" },
    });

    const evidencias =
      avances.length > 0
        ? await prisma.evidencia.findMany({
            where: { tenantId: req.user!.tenantId, entidadTipo: "avance", entidadId: { in: avances.map((a) => a.id) } },
            orderBy: { createdAt: "asc" },
          })
        : [];
    const fotosPorAvance = new Map<string, { objectKey: string; tipoMime: string | null }[]>();
    for (const ev of evidencias) {
      const lista = fotosPorAvance.get(ev.entidadId) ?? [];
      lista.push({ objectKey: ev.objectKey, tipoMime: ev.tipoMime });
      fotosPorAvance.set(ev.entidadId, lista);
    }

    const buffer = await generarReporteAvancesPdf({
      obra: {
        nombre: obra.nombre,
        cliente: obra.cliente,
        ubicacion: obra.ubicacion,
        responsable: obra.responsable?.nombreCompleto ?? null,
      },
      tenant,
      avances: avances.map((a) => ({
        id: a.id,
        fecha: a.fecha,
        descripcion: a.descripcion,
        personas: a.avancePersonas.map((ap) => ap.persona.nombreCompleto),
        fotos: fotosPorAvance.get(a.id) ?? [],
      })),
      desde,
      hasta,
    });

    const nombreArchivo = `evidencias-${obra.nombre.replace(/[^a-z0-9]+/gi, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
    res.send(buffer);
  })
);

// Descarga todas las fotos de avances de la obra en un .zip, organizadas en
// una carpeta por fecha. Se registra antes de "/:avanceId" (mismo motivo que
// "/reporte-pdf": si no, Express interpreta "fotos.zip" como un :avanceId).
avancesRouter.get(
  "/fotos.zip",
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);

    const obra = await prisma.obra.findFirst({ where: { id: obraId, tenantId: req.user!.tenantId, deletedAt: null } });
    if (!obra) throw new HttpError(404, "Obra no encontrada");

    const avances = await prisma.avance.findMany({
      where: { obraId, tenantId: req.user!.tenantId, deletedAt: null },
      orderBy: { fecha: "asc" },
    });
    const fechaPorAvance = new Map(avances.map((a) => [a.id, a.fecha.toISOString().slice(0, 10)]));

    const evidencias =
      avances.length > 0
        ? await prisma.evidencia.findMany({
            where: { tenantId: req.user!.tenantId, entidadTipo: "avance", entidadId: { in: avances.map((a) => a.id) } },
            orderBy: { createdAt: "asc" },
          })
        : [];

    const archivosDisponibles = evidencias.filter((ev) => ev.bucket === "local" && fs.existsSync(path.join(env.uploadDir, ev.objectKey)));
    if (archivosDisponibles.length === 0) throw new HttpError(404, "Esta obra no tiene fotos registradas para descargar");

    const nombreZip = `fotos-${obra.nombre.replace(/[^a-z0-9]+/gi, "-")}-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreZip}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    // El .zip se transmite en streaming (headers ya enviados): un error aqui
    // no puede convertirse en una respuesta JSON de error, solo se corta la
    // conexion.
    archive.on("error", (err) => {
      console.error("Error generando zip de fotos de avances:", err);
      res.destroy(err);
    });
    archive.pipe(res);

    const contadorPorCarpeta = new Map<string, number>();
    for (const ev of archivosDisponibles) {
      const carpeta = fechaPorAvance.get(ev.entidadId) ?? "sin-fecha";
      const indice = (contadorPorCarpeta.get(carpeta) ?? 0) + 1;
      contadorPorCarpeta.set(carpeta, indice);
      const ext = path.extname(ev.objectKey) || "";
      archive.file(path.join(env.uploadDir, ev.objectKey), { name: `${carpeta}/foto-${indice}${ext}` });
    }

    await archive.finalize();
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

const updateSchema = z
  .object({
    fecha: z.string().min(1).optional(),
    descripcion: z.string().min(1).optional(),
  })
  .refine((data) => data.fecha !== undefined || data.descripcion !== undefined, {
    message: "Debes indicar al menos una fecha o descripcion para actualizar",
  });

// Permite corregir una evidencia ya guardada (fecha o descripcion
// equivocada). El Oficial solo puede editar lo que el mismo registro;
// Administrador/Supervisor pueden editar cualquiera dentro de su alcance de
// obras (mismo criterio que el borrado de evidencias, ver evidencias.routes.ts).
avancesRouter.patch(
  "/:avanceId",
  requireRole(...ASISTENCIA_AVANCE_OPERATIVO),
  asyncHandler(async (req, res) => {
    const obraId = req.params.obraId;
    await assertObraVisible(req.user!, obraId);
    const body = updateSchema.parse(req.body);

    const existente = await prisma.avance.findFirst({
      where: { id: req.params.avanceId, obraId, tenantId: req.user!.tenantId, deletedAt: null },
    });
    if (!existente) throw new HttpError(404, "Avance no encontrado");
    if (req.user!.rol === ROLES.OFICIAL && existente.registradoPor !== req.user!.sub) {
      throw new HttpError(403, "Solo puedes editar evidencias que tu mismo registraste");
    }

    const nuevaFecha = body.fecha ? startOfDay(body.fecha) : undefined;

    const avance = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.avance.update({
        where: { id: existente.id },
        data: {
          fecha: nuevaFecha,
          descripcion: body.descripcion,
        },
      });

      // Si cambia la fecha, el personal vinculado (seccion 08, flujo 6) se
      // recalcula igual que en la creacion: se re-liga a las asistencias del
      // nuevo dia en vez de dejar el vinculo apuntando al dia anterior.
      if (nuevaFecha) {
        await tx.avancePersona.deleteMany({ where: { avanceId: actualizado.id } });
        const asistenciasDelDia = await tx.asistencia.findMany({ where: { obraId, fecha: nuevaFecha } });
        if (asistenciasDelDia.length > 0) {
          await tx.avancePersona.createMany({
            data: asistenciasDelDia.map((a) => ({
              avanceId: actualizado.id,
              personaId: a.personaId,
              asistenciaId: a.id,
            })),
          });
        }
      }

      return actualizado;
    });

    await writeAuditLog({
      tenantId: req.user!.tenantId,
      usuarioId: req.user!.sub,
      entidadTipo: "avance",
      entidadId: avance.id,
      accion: "actualizar",
      cambios: { antes: { fecha: existente.fecha, descripcion: existente.descripcion }, despues: body },
    });

    const conRelaciones = await prisma.avance.findFirst({
      where: { id: avance.id },
      include: { avancePersonas: { include: { persona: true } } },
    });
    res.json(conRelaciones);
  })
);
