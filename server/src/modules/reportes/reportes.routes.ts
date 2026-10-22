import { Router } from "express";
import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, HttpError } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertObraVisible, visibleObraIds } from "../../lib/obraScope";
import { resumenFinancieroObra } from "../../lib/finance";
import { REPORTE_EXPORT, REPORTE_EXPORT_FINANCIERO, ROLES, SIN_ACCESO_FINANCIERO, VER_PRESUPUESTO } from "../../lib/roles";
import { FECHA_ISO, isoLocal, startOfDay } from "../../lib/dates";
import { calcularIndicadores } from "../../lib/indicadores";
import { montoConSigno } from "../../lib/finance";
import { colorExcelArgb, textoSobre } from "../../lib/marca";

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

const indicadoresSchema = z.object({
  desde: z.string().regex(FECHA_ISO),
  hasta: z.string().regex(FECHA_ISO),
  hoy: z.string().regex(FECHA_ISO),
  obra_id: z.string().optional(),
});

// Indicadores de operacion para Dashboard y Reportes > Indicadores. Respeta el
// alcance de obras del usuario y oculta montos a quien no ve finanzas.
reportesRouter.get(
  "/indicadores",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.rol === ROLES.OFICIAL) throw new HttpError(403, "Rol no autorizado");
    const q = indicadoresSchema.parse(req.query);
    if (q.desde > q.hasta) throw new HttpError(400, "Rango de fechas invalido");
    const verFinanciero = !SIN_ACCESO_FINANCIERO.includes(user.rol as (typeof SIN_ACCESO_FINANCIERO)[number]);
    const scope = await visibleObraIds(user);
    if (q.obra_id) await assertObraVisible(user, q.obra_id);

    const obras = await prisma.obra.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        ...(q.obra_id ? { id: q.obra_id } : scope === "ALL" ? {} : { id: { in: scope } }),
      },
      orderBy: { createdAt: "asc" },
    });
    const ids = obras.map((o) => o.id);
    const hastaConHoy = q.hoy > q.hasta ? q.hoy : q.hasta;
    const rangoFecha = { gte: startOfDay(q.desde), lte: startOfDay(hastaConHoy) };

    const [asistencias, avances, obraPersonas, herramientas, asignaciones, personas, transacciones] = await Promise.all([
      prisma.asistencia.findMany({ where: { obraId: { in: ids }, fecha: rangoFecha }, select: { obraId: true, personaId: true, fecha: true, horaLlegada: true } }),
      prisma.avance.findMany({ where: { obraId: { in: ids }, deletedAt: null, fecha: rangoFecha }, select: { id: true, obraId: true, fecha: true } }),
      prisma.obraPersona.findMany({
        where: { obraId: { in: ids }, activo: true, persona: { activo: true, deletedAt: null } },
        select: { obraId: true, personaId: true, persona: { select: { nombreCompleto: true } } },
      }),
      prisma.herramienta.findMany({ where: { tenantId: user.tenantId, deletedAt: null }, select: { estado: true } }),
      prisma.herramientaAsignacion.findMany({ where: { obraId: { in: ids }, fechaDevolucion: null }, select: { obraId: true, herramienta: { select: { nombre: true } } } }),
      scope === "ALL" && !q.obra_id ? prisma.persona.findMany({ where: { tenantId: user.tenantId, activo: true, deletedAt: null }, select: { id: true } }) : Promise.resolve(undefined),
      // shortcut: trae todas las transacciones de las obras y filtra por fecha en memoria; mover el filtro a SQL si una obra pasa de miles de movimientos.
      verFinanciero
        ? prisma.transaccion.findMany({
            where: { obraId: { in: ids } },
            select: { obraId: true, tipo: true, monto: true, createdAt: true, asistencia: { select: { fecha: true } }, remision: { select: { fecha: true } } },
          })
        : Promise.resolve([]),
    ]);
    const fotos = avances.length
      ? await prisma.evidencia.groupBy({
          by: ["entidadId"],
          where: { entidadTipo: "avance", entidadId: { in: avances.map((a) => a.id) }, tipoMime: { startsWith: "image/" } },
          _count: true,
        })
      : [];
    const financieros = verFinanciero ? await Promise.all(obras.map((o) => resumenFinancieroObra(o.id))) : [];

    res.json(
      calcularIndicadores(
        {
          obras: obras.map((o, i) => ({
            id: o.id,
            nombre: o.nombre,
            presupuesto: financieros[i]?.presupuestoTotal ?? 0,
            consumido: financieros[i]?.consumidoTotal ?? 0,
            fechaInicio: o.fechaInicio ? isoLocal(o.fechaInicio) : null,
            fechaFinEstimada: o.fechaFinEstimada ? isoLocal(o.fechaFinEstimada) : null,
          })),
          asistencias: asistencias.map((a) => ({ ...a, fecha: isoLocal(a.fecha) })),
          avances: avances.map((a) => ({ obraId: a.obraId, fecha: isoLocal(a.fecha), fotos: fotos.find((f) => f.entidadId === a.id)?._count ?? 0 })),
          transacciones: transacciones.map((t) => ({
            obraId: t.obraId,
            tipo: t.tipo,
            monto: t.monto,
            fecha: isoLocal(t.asistencia?.fecha ?? t.remision?.fecha ?? t.createdAt),
          })),
          obraPersonas: obraPersonas.map((op) => ({ obraId: op.obraId, personaId: op.personaId, nombre: op.persona.nombreCompleto })),
          personasActivas: personas,
          herramientas,
          asignaciones: asignaciones.filter((a) => a.obraId).map((a) => ({ obraId: a.obraId!, nombre: a.herramienta.nombre })),
        },
        { desde: q.desde, hasta: q.hasta, hoy: q.hoy, verFinanciero }
      )
    );
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

    await construirHoja(workbook, tipo, filtros, req.user!.tenantId, obraIdsPermitidas, VER_PRESUPUESTO.includes(rol));

    // Encabezados con el color de la empresa (configurable en Empresa).
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { colorPrimario: true } });
    const argb = colorExcelArgb(tenant?.colorPrimario);
    if (argb) {
      workbook.eachSheet((sheet) => {
        sheet.getRow(1).eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
          cell.font = { bold: true, color: { argb: colorExcelArgb(textoSobre(tenant?.colorPrimario)) } };
        });
      });
    }

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
  tenantId: string,
  obraIdsPermitidas: string[] | undefined,
  puedeVerFinanciero: boolean
): Promise<void> {
  const obraWhere = { tenantId, ...(obraIdsPermitidas ? { id: { in: obraIdsPermitidas } } : {}) };
  const obraFk = {
    tenantId,
    ...(filtros.obra_id
      ? { obraId: filtros.obra_id }
      : obraIdsPermitidas
        ? { obraId: { in: obraIdsPermitidas } }
        : {}),
  };
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
      // Bonos y comisiones asignados al trabajador tambien son su costo.
      const bonos = await prisma.transaccion.findMany({
        where: {
          obraId: obra.id,
          tipo: { in: ["bono", "comision"] },
          personaId: { not: null },
          createdAt: rangoFecha.gte || rangoFecha.lte ? rangoFecha : undefined,
        },
        include: { persona: true },
      });
      for (const b of bonos) {
        const actual = porPersona.get(b.personaId!) ?? { nombre: b.persona!.nombreCompleto, count: 0, costo: 0 };
        actual.costo += b.monto;
        porPersona.set(b.personaId!, actual);
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
      where: { tenantId, ...(filtros.obra_id ? { obraId: filtros.obra_id } : {}) },
      include: { herramienta: true, obra: true, persona: true },
      orderBy: { fechaAsignacion: "desc" },
    });
    for (const a of asignaciones) {
      sheet.addRow({
        codigo: a.herramienta.codigo,
        nombre: a.herramienta.nombre,
        custodio: a.persona?.nombreCompleto ?? a.custodioNombre ?? "",
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
      { header: "Bonos/comisiones", key: "bonos", width: 18 },
      { header: "Otros costos", key: "otros", width: 16 },
      { header: "Total", key: "total", width: 16 },
      { header: "% del presupuesto", key: "pct", width: 16 },
    ];
    const obras = await prisma.obra.findMany({ where: { ...obraWhere, deletedAt: null } });
    for (const obra of obras) {
      const transacciones = await prisma.transaccion.findMany({ where: { obraId: obra.id, createdAt: rangoFecha.gte || rangoFecha.lte ? rangoFecha : undefined } });
      const mo = transacciones.filter((t) => t.tipo === "costo_mano_obra").reduce((a, t) => a + t.monto, 0);
      const mat = transacciones.filter((t) => t.tipo === "costo_material").reduce((a, t) => a + t.monto, 0);
      const bonos = transacciones.filter((t) => t.tipo === "bono" || t.tipo === "comision").reduce((a, t) => a + t.monto, 0);
      const otros = transacciones.filter((t) => t.tipo === "otro_costo").reduce((a, t) => a + t.monto, 0);
      const total = mo + mat + bonos + otros;
      const presupuesto = (await resumenFinancieroObra(obra.id)).presupuestoTotal;
      sheet.addRow({ obra: obra.nombre, mo, mat, bonos, otros, total, pct: presupuesto > 0 ? `${((total / presupuesto) * 100).toFixed(1)}%` : "n/a" });
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
      const monto = montoConSigno(t.tipo, t.monto);
      const row = sheet.addRow({
        obra: t.obra.nombre,
        partida: t.partida.nombre,
        tipo: t.tipo,
        persona: t.persona?.nombreCompleto ?? "",
        monto,
        motivo: t.motivoAjuste ?? "",
        editor: t.updatedBy ?? "",
        fecha_edicion: t.updatedBy ? t.updatedAt.toISOString().slice(0, 10) : "",
      });
      row.getCell("monto").font = { color: { argb: monto < 0 ? ROJO : VERDE }, bold: true };
    }
    return;
  }
}
