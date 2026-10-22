import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { hoyLocal } from "../lib/fechas";
import { etiquetaEstadoHerramienta } from "../lib/etiquetas";
import { haceDias, pesos, useIndicadores } from "../lib/indicadores";
import { Obra } from "../lib/types";
import { FilaKpis, Input, Kpi, ListaCard, Tabla, td, th } from "../components/ui";
import { BarraConsumo, BarraSegmentos, BarrasHorizontales, MapaCalor, SERIE, SinDatos } from "../components/graficas";

type Periodo = "14" | "mes" | "otro";
const COLOR_ESTADO: Record<string, string> = { asignada: SERIE.naranja, disponible: "#1E7A46", mantenimiento: "#C26A00", baja: "#8A8F98" };

// Reportes > Indicadores: personal, herramientas y cumplimiento por periodo y obra.
export function IndicadoresPanel() {
  const hoy = hoyLocal();
  const [periodo, setPeriodo] = useState<Periodo>("14");
  const [desdeOtro, setDesdeOtro] = useState(haceDias(29));
  const [hastaOtro, setHastaOtro] = useState(hoy);
  const [obraId, setObraId] = useState("");
  const obras = useQuery({ queryKey: ["obras"], queryFn: () => api.get<Obra[]>("/obras").then((r) => r.data) });

  const [desde, hasta] =
    periodo === "14" ? [haceDias(13), hoy] : periodo === "mes" ? [`${hoy.slice(0, 8)}01`, hoy] : [desdeOtro, hastaOtro <= desdeOtro ? desdeOtro : hastaOtro];
  const q = useIndicadores(desde, hasta, obraId || undefined);
  const ind = q.data;
  const k = ind?.kpis;

  const boton = (p: Periodo, label: string) => (
    <button
      type="button"
      aria-pressed={periodo === p}
      onClick={() => setPeriodo(p)}
      className={`min-h-[44px] rounded-full border px-3 text-sm ${periodo === p ? "border-graphite bg-graphite text-white" : "border-[#D9D9D4] bg-white text-[#3A3F46]"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {boton("14", "Últimos 14 días")}
        {boton("mes", "Este mes")}
        {boton("otro", "Personalizado")}
        {periodo === "otro" && (
          <span className="flex flex-wrap items-center gap-2">
            <Input type="date" aria-label="Desde" value={desdeOtro} max={hoy} onChange={(e) => setDesdeOtro(e.target.value)} className="!w-auto" />
            <Input type="date" aria-label="Hasta" value={hastaOtro} max={hoy} onChange={(e) => setHastaOtro(e.target.value)} className="!w-auto" />
          </span>
        )}
        <label htmlFor="ind-obra" className="flex w-full min-w-0 items-center gap-2 text-sm text-ink-soft sm:ml-auto sm:w-auto">
          Obra
          <select id="ind-obra" aria-label="Obra" value={obraId} onChange={(e) => setObraId(e.target.value)} className="min-h-[44px] w-full min-w-0 max-w-full rounded-md border border-[#CFCFCA] bg-white px-3 text-sm text-ink sm:w-64">
            <option value="">Todas</option>
            {obras.data?.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </label>
      </div>

      {q.isError && <p className="text-sm text-crit">No se pudieron cargar los indicadores.</p>}
      {!ind ? (
        <p className="text-sm text-ink-soft">Cargando indicadores…</p>
      ) : (
        <>
          <FilaKpis>
            <Kpi label="Días-hombre" valor={k!.diasHombre} nota="asistencias en el periodo" />
            <Kpi label="Personal hoy" valor={`${k!.personalHoy.llegaron} / ${k!.personalHoy.asignados}`} nota="llegaron / asignados" tono={k!.personalHoy.llegaron ? "neutral" : "warn"} />
            <Kpi label="Llegada promedio" valor={k!.llegadaPromedio ?? "—"} nota="hora de llegada" />
            <Kpi
              label="Bitácora al día"
              valor={k!.bitacoraAlDia.total ? `${Math.round((k!.bitacoraAlDia.con / k!.bitacoraAlDia.total) * 100)}%` : "—"}
              nota={`${k!.bitacoraAlDia.con} de ${k!.bitacoraAlDia.total} días con evidencia con foto`}
            />
            <Kpi label="Herramientas en uso" valor={`${k!.herramientasEnUso.asignadas} / ${k!.herramientasEnUso.total}`} nota={`${k!.herramientasEnUso.total - k!.herramientasEnUso.asignadas} sin asignar`} />
            {k!.costoDiaHombre !== undefined && <Kpi label="Costo día-hombre" valor={pesos(k!.costoDiaHombre)} nota="promedio de mano de obra" />}
          </FilaKpis>

          <ListaCard titulo="Personal en obra por día" subtitulo="Personas con asistencia registrada, por obra y día">
            <div className="p-4 sm:p-5">
              <MapaCalor dias={ind.dias} filas={ind.personalPorDia} unidad="personas" />
            </div>
          </ListaCard>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <ListaCard titulo="Obras por persona" subtitulo="Obras asignadas a cada trabajador">
              <div className="space-y-4 p-4 sm:p-5">
                <BarrasHorizontales
                  vacio="Nadie tiene obras asignadas."
                  items={ind.obrasPorPersona.map((p) => ({ nombre: p.nombre, valor: p.obras.length, detalle: p.obras.join(" · ") }))}
                />
                {ind.personasSinObra !== undefined && ind.personasSinObra > 0 && (
                  <p className="border-t border-[#EDEDEA] pt-3 text-sm text-warn">
                    {ind.personasSinObra} {ind.personasSinObra === 1 ? "persona activa" : "personas activas"} sin obra asignada ·{" "}
                    <Link to="/personas" className="font-medium text-accent">Ver personas</Link>
                  </p>
                )}
              </div>
            </ListaCard>

            <ListaCard titulo="Herramientas por obra" subtitulo="Asignadas y sin devolver">
              <div className="space-y-4 p-4 sm:p-5">
                <BarrasHorizontales
                  color={SERIE.naranja}
                  vacio="Ninguna obra tiene herramientas asignadas."
                  items={ind.herramientasPorObra.map((h) => ({ nombre: h.nombre, valor: h.herramientas.length, detalle: h.herramientas.join(" · ") }))}
                />
                <div className="space-y-2 border-t border-[#EDEDEA] pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Estado del inventario</p>
                  <BarraSegmentos
                    items={Object.entries(ind.inventario).map(([estado, n]) => ({ nombre: etiquetaEstadoHerramienta(estado), valor: n, color: COLOR_ESTADO[estado] ?? "#8A8F98" }))}
                  />
                </div>
              </div>
            </ListaCard>

            <ListaCard titulo="Cumplimiento de bitácora" subtitulo="Días con asistencia que tienen evidencia con foto">
              <div className="space-y-4 p-4 sm:p-5">
                {ind.cumplimiento.every((c) => c.total === 0) ? (
                  <SinDatos>No hubo asistencias en el periodo.</SinDatos>
                ) : (
                  ind.cumplimiento
                    .filter((c) => c.total > 0)
                    .map((c) => (
                      <BarraConsumo key={c.obraId} etiqueta={c.nombre} detalle={`${c.con} de ${c.total} días`} pct={(c.con / c.total) * 100} />
                    ))
                )}
              </div>
            </ListaCard>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <ListaCard titulo="Días-hombre y costo de mano de obra" subtitulo="Por obra, en el periodo">
              <Tabla minWidth={420}>
                <thead>
                  <tr>
                    <th className={th}>Obra</th>
                    <th className={`${th} text-right`}>Días-h</th>
                    {k!.costoDiaHombre !== undefined && <th className={`${th} text-right`}>Costo</th>}
                    {k!.costoDiaHombre !== undefined && <th className={`${th} text-right`}>Por día-h</th>}
                  </tr>
                </thead>
                <tbody>
                  {ind.diasHombre.map((d) => (
                    <tr key={d.obraId}>
                      <td className={`${td} font-medium`}>{d.nombre}</td>
                      <td className={`${td} num text-right`}>{d.dias}</td>
                      {d.costo !== undefined && <td className={`${td} num text-right`}>{pesos(d.costo)}</td>}
                      {d.costo !== undefined && <td className={`${td} num text-right`}>{d.dias ? pesos(d.costo / d.dias) : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </ListaCard>

            {ind.plazoGasto && (
              <ListaCard titulo="Plazo contra gasto" subtitulo="% del tiempo transcurrido junto al % del presupuesto consumido">
                <div className="space-y-5 p-4 sm:p-5">
                  {ind.plazoGasto.length === 0 ? (
                    <SinDatos>
                      Ninguna obra tiene <strong className="text-ink">fecha fin estimada</strong>. Captúrala en “Editar obra” para ver si el gasto va adelantado al tiempo.
                    </SinDatos>
                  ) : (
                    ind.plazoGasto.map((p) => (
                      <div key={p.obraId} className="space-y-2">
                        <p className="text-sm font-medium">{p.nombre}</p>
                        <BarraConsumo etiqueta="Tiempo" detalle={`${p.pctTiempo}%`} pct={p.pctTiempo} color="#6B7079" />
                        <BarraConsumo
                          etiqueta="Gasto"
                          detalle={`${p.pctGasto}%`}
                          pct={p.pctGasto}
                          color={SERIE.naranja}
                          alerta={p.pctGasto > p.pctTiempo + 10 ? "El gasto va adelantado al tiempo" : undefined}
                        />
                      </div>
                    ))
                  )}
                </div>
              </ListaCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
