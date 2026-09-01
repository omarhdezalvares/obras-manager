import { Router } from "express";
import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertObraVisible, visibleObraIds } from "../../lib/obraScope";
import { resumenFinancieroObra } from "../../lib/finance";
import { REPORTE_EXPORT, REPORTE_EXPORT_FINANCIERO, ROLES, VER_PRESUPUESTO } from "../../lib/roles";
import { startOfDay } from "../../lib/dates";
import { esGasto } from "../../lib/finance";

export const reportesRouter = Router();
reportesRouter.use(requireAuth);

const VERDE = "FF1E7A3D";
const ROJO = "FFB3261E";

// Dashboard financiero de una obra (seccion 12: GET /reportes/presupuesto-vs-real).
reportesRouter.get(
  "/presupuesto-vs-real",
  asyncHandler(async (req, res) => {
    const rol = req.user!.rol as (typeof ROLES)[keyof typeof ROLES];
    if (!VER_PRESUPUESTO.includes(rol)) throw new HttpError(403, "Rol no autorizado para ver informacion de presupuesto");
    const obraId = String(req.query.obra_id ?? "");
    if (!obraId) throw new HttpError(400, "Falta obra_id");
    await assertObraVisible(req.user!, obraId);
    res.json(await resumenFinancieroObra(obraId));
  })
);

const TIPOS = [
  "avances",
  "asistencias-obra",
  "asistencias-persona",
  "general-equipo",
  "presupuesto-vs-real",
  "materiales-remision",
  "herramientas",
  "costos-obra",
  "transacciones",
] as const;

// Reportes con contenido financiero/de presupuesto: solo Administrador y
// Finanzas pueden generarlos (Gerente de Proyecto y Oficial quedan fuera).
const TIPOS_FINANCIEROS: (typeof TIPOS)[number][] = [
  "presupuesto-vs-real",
  "costos-obra",
  "transacciones",
  "materiales-remision",
];

const filtrosSchema = z.object({
  obra_id: z.string().optional(),
  persona_id: z.string().optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  proveedor: z.string().optional(),
  solo_editadas: z.coerce.boolean().optional(),
});

function toDate(s?: string): Date | undefined {
  return s ? startOfDay(s) : undefined;
}

// Version de test: genera y entrega el Excel en la misma llamada. El
// documento (seccion 02/08) propone encolarlo en un worker con BullMQ para
// no bloquear el API en reportes grandes; para el volumen de un piloto de
// 2-3 obras la generacion sincronica es instantanea y evita depender de Redis.
reportesRouter.post(
  "/:tipo/exportar",
  asyncHandler(async (req, res) => {
    const tipo = req.params.tipo as (typeof TIPOS)[number];
    if (!TIPOS.includes(tipo)) throw new HttpError(404, `Tipo de reporte desconocido: ${tipo}`);

    // Seccion 06: solo Administrador, Gerente de Proyecto y Finanzas exportan;
    // Supervisor/Oficial ven reportes en pantalla pero sin boton de exportar,
    // y Lectura solo puede ver ("Total (solo ver)").
    const rol = req.user!.rol as (typeof ROLES)[keyof typeof ROLES];
    if (!REPORTE_EXPORT.includes(rol)) throw new HttpError(403, "Rol no autorizado para exportar reportes");
    if (TIPOS_FINANCIEROS.includes(tipo) && !REPORTE_EXPORT_FINANCIERO.includes(rol)) {
      throw new HttpError(403, "Rol no autorizado para exportar reportes con informacion financiera");
    }

    const filtros = filtrosSchema.parse(req.body ?? {});
    if (filtros.obra_id) await assertObraVisible(req.user!, filtros.obra_id);

    const scope = await visibleObraIds(req.user!);
    const obraIdsPermitidas = scope === "ALL" ? undefined : scope;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OBRA/OS";
    workbook.created = new Date();

    await construirHoja(workbook, tipo, filtros, obraIdsPermitidas, VER_PRESUPUESTO.includes(rol));

    const buffer = await workbook.xlsx.writeBuffer();
    const nombreArchivo = `${tipo}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
    res.send(Buffer.from(buffer));
  })
);

async function construirHoja(
  workbook: ExcelJS.Workbook,
  tipo: (typeof TIPOS)[number],
  filtros: z.infer<typeof filtrosSchema>,
  obraIdsPermitidas: string[] | undefined,
  puedeVerFinanciero: boolean
): Promise<void> {
  const obraWhere = obraIdsPermitidas ? { id: { in: obraIdsPermitidas } } : {};
  const obraFk = filtros.obra_id
    ? { obraId: filtros.obra_id }
    : obraIdsPermitidas
      ? { obraId: { in: obraIdsPermitidas } }
      : {};
  const rangoFecha = {
    gte: toDate(filtros.fecha_desde),
    lte: toDate(filtros.fecha_hasta),
  };

  if (tipo === "avances") {
    const sheet = workbook.addWorksheet("Evidencias");
    sheet.columns = [
      { header: "Obra", key: "obra", width: 24 },
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Descripcion", key: "descripcion", width: 50 },
      { header: "Personas presentes", key: "personas", width: 40 },
      { header: "Fotos", key: "evidencias", width: 12 },
    ];
    const avances = await prisma.avance.findMany({
      where: { ...obraFk, fecha: rangoFecha, deletedAt: null },
      include: { obra: true, avancePersonas: { include: { persona: true } } },
      orderBy: { fecha: "desc" },
    });
    for (const a of avances) {
      const evidencias = await prisma.evidencia.count({ where: { entidadTipo: "avance", entidadId: a.id } });
      sheet.addRow({
        obra: a.obra.nombre,
        fecha: a.fecha.toISOString().slice(0, 10),
        descripcion: a.descripcion,
        personas: a.avancePersonas.map((ap) => ap.persona.nombreCompleto).join(", "),
        evidencias,
      });
    }
    return;
  }

  if (tipo === "asistencias-obra" || tipo === "asistencias-persona") {
    const sheet = workbook.addWorksheet("Asistencias");
    sheet.columns = [
      { header: "Obra", key: "obra", width: 24 },
      { header: "Persona", key: "persona", width: 26 },
      { header: "Fecha", key: "fecha", width: 14 },
      { header: "Hora llegada", key: "hora", width: 12 },
      ...(puedeVerFinanciero ? [{ header: "Costo aplicado", key: "costo", width: 14 }] : []),
      { header: "Registrado por", key: "registro", width: 26 },
    ];
    const asistencias = await prisma.asistencia.findMany({
      where: { ...obraFk, personaId: filtros.persona_id, fecha: rangoFecha },
      include: { obra: true, persona: true, transaccion: true },
      orderBy: { fecha: "desc" },
    });
    for (const a of asistencias) {
      sheet.addRow({
        obra: a.obra.nombre,
        persona: a.persona.nombreCompleto,
        fecha: a.fecha.toISOString().slice(0, 10),
        hora: a.horaLlegada,
        ...(puedeVerFinanciero ? { costo: a.transaccion?.monto ?? 0 } : {}),
        registro: a.registradoPor,
      });
    }
    return;
  }

  if (tipo === "general-equipo") {
    const sheet = workbook.addWorksheet("General de equipo");
    sheet.columns = [
      { header: "Obra", key: "obra", width: 24 },
      { header: "Persona", key: "persona", width: 26 },
      { header: "Asistencias en el periodo", key: "asistencias", width: 22 },
      ...(puedeVerFinanciero ? [{ header: "Costo acumulado", key: "costo", width: 16 }] : []),
    ];
    const obras = await prisma.obra.findMany({ where: { ...obraWhere, deletedAt: null } });
    for (const obra of obras) {
      const asistencias = await prisma.asistencia.findMany({
        where: { obraId: obra.id, fecha: rangoFecha },
        include: { persona: true, transaccion: true },
      });
      const porPersona = new Map<string, { nombre: string; count: number; costo: number }>();
      for (const a of asistencias) {
        const actual = porPersona.get(a.personaId) ?? { nombre: a.persona.nombreCompleto, count: 0, costo: 0 };
        actual.count += 1;
        actual.costo += a.transaccion?.monto ?? 0;
        porPersona.set(a.personaId, actual);
      }
      for (const p of porPersona.values()) {
        sheet.addRow({ obra: obra.nombre, persona: p.nombre, asistencias: p.count, ...(puedeVerFinanciero ? { costo: p.costo } : {}) });
      }
    }
    return;
  }

  if (tipo === "presupuesto-vs-real") {
    const sheet = workbook.addWorksheet("Presupuesto vs. real");
    sheet.columns = [
      { header: "Obra", key: "obra", width: 24 },
      { header: "Partida", key: "partida", width: 22 },
      { header: "Presupuesto (+)", key: "presupuesto", width: 16 },
      { header: "Consumido (-)", key: "consumido", width: 16 },
      { header: "Disponible", key: "disponible", width: 16 },
      { header: "% consumido", key: "pct", width: 14 },
    ];
    const obras = await prisma.obra.findMany({ where: { ...obraWhere, deletedAt: null } });
    for (const obra of obras) {
      const resumen = await resumenFinancieroObra(obra.id);
      for (const p of resumen.partidas) {
        const row = sheet.addRow({
          obra: obra.nombre,
          partida: p.nombre,
          presupuesto: Math.abs(p.presupuestoActualizado || p.presupuestoInicial),
          consumido: -Math.abs(p.consumido),
          disponible: p.disponible,
          pct: `${p.porcentajeConsumido.toFixed(1)}%`,
        });
        row.getCell("presupuesto").font = { color: { argb: VERDE }, bold: true };
        row.getCell("consumido").font = { color: { argb: ROJO }, bold: true };
        row.getCell("disponible").font = { color: { argb: p.disponible < 0 ? ROJO : VERDE } };
      }
    }
    return;
  }

  if (tipo === "materiales-remision") {
    const sheet = workbook.addWorksheet("Materiales por remision");
    sheet.columns = [
      { header: "Obra", key: "obra", width: 24 },
      { header: "Folio", key: "folio", width: 14 },
      { header: "Proveedor", key: "proveedor", width: 22 },
      { header: "Material", key: "material", width: 22 },
      { header: "Cantidad", key: "cantidad", width: 12 },
      { header: "Costo unitario", key: "unitario", width: 14 },
      { header: "Costo total", key: "total", width: 14 },
    ];
    const remisiones = await prisma.remision.findMany({
      where: { ...obraFk, fecha: rangoFecha, proveedor: filtros.proveedor ? { contains: filtros.proveedor } : undefined, deletedAt: null },
      include: { obra: true, materiales: { include: { material: true } } },
      orderBy: { fecha: "desc" },
    });
    for (const r of remisiones) {
      for (const m of r.materiales) {
        sheet.addRow({
          obra: r.obra.nombre,
          folio: r.folio ?? "",
          proveedor: r.proveedor,
          material: m.material.nombre,
          cantidad: m.cantidad,
          unitario: m.costoUnitario,
          total: m.costoTotal,
        });
      }
    }
    return;
  }

  if (tipo === "herramientas") {
    const sheet = workbook.addWorksheet("Herramientas asignadas");
    sheet.columns = [
      { header: "Codigo", key: "codigo", width: 14 },
      { header: "Herramienta", key: "nombre", width: 24 },
      { header: "Custodio actual", key: "custodio", width: 24 },
      { header: "Obra", key: "obra", width: 24 },
      { header: "Fecha asignacion", key: "fecha_asig", width: 16 },
      { header: "Fecha devolucion", key: "fecha_dev", width: 16 },
    ];
    const asignaciones = await prisma.herramientaAsignacion.findMany({
      where: filtros.obra_id ? { obraId: filtros.obra_id } : {},
      include: { herramienta: true, obra: true, persona: true },
      orderBy: { fechaAsignacion: "desc" },
    });
    for (const a of asignaciones) {
      sheet.addRow({
        codigo: a.herramienta.codigo,
        nombre: a.herramienta.nombre,
        custodio: a.persona?.nombreCompleto ?? "",
        obra: a.obra?.nombre ?? "",
        fecha_asig: a.fechaAsignacion.toISOString().slice(0, 10),
        fecha_dev: a.fechaDevolucion ? a.fechaDevolucion.toISOString().slice(0, 10) : "",
      });
    }
    return;
  }

  if (tipo === "costos-obra") {
    const sheet = workbook.addWorksheet("Costos por obra");
    sheet.columns = [
      { header: "Obra", key: "obra", width: 24 },
      { header: "Mano de obra", key: "mo", width: 16 },
      { header: "Materiales", key: "mat", width: 16 },
      { header: "Otros costos", key: "otros", width: 16 },
      { header: "Total", key: "total", width: 16 },
      { header: "% del presupuesto", key: "pct", width: 16 },
    ];
    const obras = await prisma.obra.findMany({ where: { ...obraWhere, deletedAt: null } });
    for (const obra of obras) {
      const transacciones = await prisma.transaccion.findMany({ where: { obraId: obra.id, createdAt: rangoFecha.gte || rangoFecha.lte ? rangoFecha : undefined } });
      const mo = transacciones.filter((t) => t.tipo === "costo_mano_obra").reduce((a, t) => a + t.monto, 0);
      const mat = transacciones.filter((t) => t.tipo === "costo_material").reduce((a, t) => a + t.monto, 0);
      const otros = transacciones.filter((t) => t.tipo === "otro_costo").reduce((a, t) => a + t.monto, 0);
      const total = mo + mat + otros;
      const presupuesto = obra.presupuestoAutorizado;
      sheet.addRow({ obra: obra.nombre, mo, mat, otros, total, pct: presupuesto > 0 ? `${((total / presupuesto) * 100).toFixed(1)}%` : "n/a" });
    }
    return;
  }

  if (tipo === "transacciones") {
    const sheet = workbook.addWorksheet("Transacciones y ajustes");
    sheet.columns = [
      { header: "Obra", key: "obra", width: 24 },
      { header: "Partida", key: "partida", width: 20 },
      { header: "Tipo", key: "tipo", width: 16 },
      { header: "Persona (asistencia)", key: "persona", width: 24 },
      { header: "Monto", key: "monto", width: 14 },
      { header: "Motivo de ajuste", key: "motivo", width: 40 },
      { header: "Editado por", key: "editor", width: 20 },
      { header: "Fecha edicion", key: "fecha_edicion", width: 16 },
    ];
    const transacciones = await prisma.transaccion.findMany({
      where: { ...obraFk, ...(filtros.solo_editadas ? { updatedBy: { not: null } } : {}) },
      include: { obra: true, partida: true, persona: true },
      orderBy: { createdAt: "desc" },
    });
    for (const t of transacciones) {
      const gasto = esGasto(t.tipo);
      const row = sheet.addRow({
        obra: t.obra.nombre,
        partida: t.partida.nombre,
        tipo: t.tipo,
        persona: t.tipo === "costo_mano_obra" ? (t.persona?.nombreCompleto ?? "") : "",
        monto: gasto ? -Math.abs(t.monto) : Math.abs(t.monto),
        motivo: t.motivoAjuste ?? "",
        editor: t.updatedBy ?? "",
        fecha_edicion: t.updatedBy ? t.updatedAt.toISOString().slice(0, 10) : "",
      });
      row.getCell("monto").font = { color: { argb: gasto ? ROJO : VERDE }, bold: true };
    }
    return;
  }
}
