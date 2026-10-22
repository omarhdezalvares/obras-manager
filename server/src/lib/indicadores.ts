// Indicadores de operacion (Reportes > Indicadores y Dashboard). Funcion pura:
// la ruta junta los datos ya filtrados por alcance; aqui solo se agrega.
// Fechas como "YYYY-MM-DD" en hora local; "hoy" lo manda el cliente.

export interface DatosIndicadores {
  obras: { id: string; nombre: string; presupuesto: number; consumido: number; fechaInicio: string | null; fechaFinEstimada: string | null }[];
  asistencias: { obraId: string; personaId: string; fecha: string; horaLlegada: string }[];
  avances: { obraId: string; fecha: string; fotos: number }[];
  transacciones: { obraId: string; fecha: string; tipo: string; monto: number }[];
  obraPersonas: { obraId: string; personaId: string; nombre: string }[];
  // Solo cuando quien consulta ve todo el tenant; si no, "sin obra" no se informa.
  personasActivas?: { id: string }[];
  herramientas: { estado: string }[];
  asignaciones: { obraId: string; nombre: string }[];
}

export interface Indicadores {
  dias: string[];
  kpis: {
    diasHombre: number;
    personalHoy: { llegaron: number; asignados: number };
    llegadaPromedio: string | null;
    bitacoraAlDia: { con: number; total: number };
    herramientasEnUso: { asignadas: number; total: number };
    costoDiaHombre?: number;
  };
  personalPorDia: { obraId: string; nombre: string; valores: number[] }[];
  gastoDiario?: { fecha: string; manoObra: number; material: number; otros: number }[];
  obrasPorPersona: { nombre: string; obras: string[] }[];
  personasSinObra?: number;
  herramientasPorObra: { obraId: string; nombre: string; herramientas: string[] }[];
  inventario: Record<string, number>;
  cumplimiento: { obraId: string; nombre: string; con: number; total: number }[];
  diasHombre: { obraId: string; nombre: string; dias: number; costo?: number }[];
  plazoGasto?: { obraId: string; nombre: string; pctTiempo: number; pctGasto: number }[];
}

const GASTO_OTROS = ["otro_costo", "bono", "comision"];

function rangoDias(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const [y, m, d] = desde.split("-").map(Number);
  for (let f = new Date(Date.UTC(y, m - 1, d)); f.toISOString().slice(0, 10) <= hasta && dias.length < 400; f.setUTCDate(f.getUTCDate() + 1)) {
    dias.push(f.toISOString().slice(0, 10));
  }
  return dias;
}

const minutos = (h: string) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + (mm || 0); };
const pct = (n: number, d: number) => (d > 0 ? Math.round(Math.min(100, Math.max(0, (n / d) * 100))) : 0);
const contar = <T,>(xs: T[], k: (x: T) => string) => xs.reduce<Record<string, number>>((acc, x) => ((acc[k(x)] = (acc[k(x)] ?? 0) + 1), acc), {});

export function calcularIndicadores(d: DatosIndicadores, opts: { desde: string; hasta: string; hoy: string; verFinanciero: boolean }): Indicadores {
  const dias = rangoDias(opts.desde, opts.hasta);
  const enRango = (f: string) => f >= opts.desde && f <= opts.hasta;
  const asist = d.asistencias.filter((a) => enRango(a.fecha));
  const trans = d.transacciones.filter((t) => enRango(t.fecha));
  const fin = opts.verFinanciero;

  const personalPorDia = d.obras.map((o) => ({
    obraId: o.id,
    nombre: o.nombre,
    valores: dias.map((dia) => new Set(asist.filter((a) => a.obraId === o.id && a.fecha === dia).map((a) => a.personaId)).size),
  }));

  // Dia de obra "al dia": hubo asistencia y una evidencia con al menos una foto.
  const conFoto = new Set(d.avances.filter((a) => a.fotos > 0).map((a) => `${a.obraId}|${a.fecha}`));
  const diasObra = new Set(asist.map((a) => `${a.obraId}|${a.fecha}`));
  const cumplimiento = d.obras.map((o) => {
    const propios = [...diasObra].filter((k) => k.startsWith(o.id + "|"));
    return { obraId: o.id, nombre: o.nombre, con: propios.filter((k) => conFoto.has(k)).length, total: propios.length };
  });

  const costoMO = (obraId?: string) => trans.filter((t) => t.tipo === "costo_mano_obra" && (!obraId || t.obraId === obraId)).reduce((s, t) => s + t.monto, 0);
  const diasHombre = d.obras.map((o) => ({
    obraId: o.id,
    nombre: o.nombre,
    dias: asist.filter((a) => a.obraId === o.id).length,
    ...(fin ? { costo: costoMO(o.id) } : {}),
  }));

  const llegadas = asist.map((a) => minutos(a.horaLlegada));
  const prom = llegadas.length ? Math.round(llegadas.reduce((s, m) => s + m, 0) / llegadas.length) : null;

  const obrasPorPersonaMap = new Map<string, { nombre: string; obras: string[] }>();
  for (const op of d.obraPersonas) {
    const obra = d.obras.find((o) => o.id === op.obraId);
    if (!obra) continue;
    const p = obrasPorPersonaMap.get(op.personaId) ?? { nombre: op.nombre, obras: [] };
    if (!p.obras.includes(obra.nombre)) p.obras.push(obra.nombre);
    obrasPorPersonaMap.set(op.personaId, p);
  }
  const obrasPorPersona = [...obrasPorPersonaMap.values()].sort((a, b) => b.obras.length - a.obras.length || a.nombre.localeCompare(b.nombre));

  return {
    dias,
    kpis: {
      diasHombre: asist.length,
      personalHoy: {
        llegaron: new Set(d.asistencias.filter((a) => a.fecha === opts.hoy).map((a) => a.personaId)).size,
        asignados: obrasPorPersonaMap.size,
      },
      llegadaPromedio: prom === null ? null : `${String(Math.floor(prom / 60)).padStart(2, "0")}:${String(prom % 60).padStart(2, "0")}`,
      bitacoraAlDia: { con: cumplimiento.reduce((s, c) => s + c.con, 0), total: diasObra.size },
      herramientasEnUso: { asignadas: d.herramientas.filter((h) => h.estado === "asignada").length, total: d.herramientas.filter((h) => h.estado !== "baja").length },
      ...(fin ? { costoDiaHombre: asist.length ? Math.round(costoMO() / asist.length) : 0 } : {}),
    },
    personalPorDia,
    ...(fin
      ? {
          gastoDiario: dias.map((fecha) => {
            const delDia = trans.filter((t) => t.fecha === fecha);
            const suma = (f: (tipo: string) => boolean) => delDia.filter((t) => f(t.tipo)).reduce((s, t) => s + t.monto, 0);
            return { fecha, manoObra: suma((t) => t === "costo_mano_obra"), material: suma((t) => t === "costo_material"), otros: suma((t) => GASTO_OTROS.includes(t)) };
          }),
        }
      : {}),
    obrasPorPersona,
    ...(d.personasActivas ? { personasSinObra: d.personasActivas.filter((p) => !obrasPorPersonaMap.has(p.id)).length } : {}),
    herramientasPorObra: d.obras.map((o) => ({ obraId: o.id, nombre: o.nombre, herramientas: d.asignaciones.filter((a) => a.obraId === o.id).map((a) => a.nombre) })),
    inventario: contar(d.herramientas, (h) => h.estado),
    cumplimiento,
    diasHombre,
    ...(fin
      ? {
          plazoGasto: d.obras
            .filter((o) => o.fechaInicio && o.fechaFinEstimada)
            .map((o) => {
              const ini = Date.parse(o.fechaInicio!), finE = Date.parse(o.fechaFinEstimada!);
              return { obraId: o.id, nombre: o.nombre, pctTiempo: pct(Date.parse(opts.hoy) - ini, finE - ini), pctGasto: o.presupuesto > 0 ? Math.round((o.consumido / o.presupuesto) * 100) : 0 };
            }),
        }
      : {}),
  };
}
