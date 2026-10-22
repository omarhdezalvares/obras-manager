import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { puedeVerFinanciero, useAuth } from "../lib/auth";
import { Notificaciones } from "../lib/types";
import { useObrasHoy } from "../lib/obrasHoy";
import { fechaCorta, fechaLarga, hoyLocal } from "../lib/fechas";
import { etiquetaEstadoObra } from "../lib/etiquetas";
import { haceDias, pesos, pesosCorto, useIndicadores } from "../lib/indicadores";
import { EmptyState, Encabezado, FilaKpis, Kpi, ListaCard, Pill, Tabla, td, th } from "../components/ui";
import { BarraConsumo, ColumnasApiladas, Leyenda, MapaCalor, SERIE } from "../components/graficas";

interface Pendiente {
  titulo: string;
  detalle: string;
  to: string;
  accion: string;
  gravedad: "crit" | "warn" | "info";
}

const PUNTO = { crit: "bg-crit", warn: "bg-warn-mark", info: "bg-[#6B7079]" };

export function Dashboard() {
  const { usuario } = useAuth();
  const verFinanciero = puedeVerFinanciero(usuario?.rol);
  const obrasQuery = useObrasHoy();
  const notifQuery = useQuery({
    queryKey: ["notificaciones"],
    queryFn: () => api.get<Notificaciones>("/notificaciones").then((r) => r.data),
  });
  const hoy = hoyLocal();
  const ind = useIndicadores(haceDias(13), hoy).data;

  const obras = obrasQuery.data ?? [];
  const activas = obras.filter((o) => o.estado === "en_ejecucion");
  const presupuestoTotal = obras.reduce((a, o) => a + (o.presupuestoTotal ?? 0), 0);
  const consumidoTotal = obras.reduce((a, o) => a + (o.consumidoTotal ?? 0), 0);
  const pctTotal = presupuestoTotal > 0 ? (consumidoTotal / presupuestoTotal) * 100 : 0;

  // Pendientes de hoy: lo que hay que resolver, de lo mas grave a lo menos,
  // cada uno lleva a donde se resuelve. Une los antiguos "Para hoy" y "Alertas".
  const hace7 = haceDias(7);
  const sinFoto = (notifQuery.data?.avancesIncompletos ?? []).filter((a) => a.fecha >= hace7);
  const porObra = new Map<string, { nombre: string; id: string; fechas: string[] }>();
  for (const a of sinFoto) {
    const g = porObra.get(a.obraId) ?? { nombre: a.obraNombre, id: a.obraId, fechas: [] };
    g.fechas.push(fechaCorta(a.fecha));
    porObra.set(a.obraId, g);
  }
  const gruposSinFoto = [...porObra.values()];
  const pendientes: Pendiente[] = [
    ...(verFinanciero
      ? obras
          .filter((o) => o.alertaPartida)
          .map((o): Pendiente => ({
            titulo: o.alertaPartida!.porcentaje > 100 ? "Partida sobregirada" : "Partida casi agotada",
            detalle: `${o.nombre} · ${o.alertaPartida!.nombre} al ${o.alertaPartida!.porcentaje}%`,
            to: `/obras/${o.id}?tab=dinero`,
            accion: "Revisar",
            gravedad: "crit",
          }))
      : []),
    ...activas
      .filter((o) => o.hoy?.asistencias === 0)
      .map((o): Pendiente => ({ titulo: "Sin asistencia hoy", detalle: o.nombre, to: `/obras/${o.id}?tab=hoy`, accion: "Registrar", gravedad: "warn" })),
    ...(notifQuery.data?.sinActividad ?? []).map((n): Pendiente => ({ titulo: "Obra sin actividad", detalle: n.mensaje, to: `/obras/${n.obraId}?tab=hoy`, accion: "Ver", gravedad: "warn" })),
    // Las de sobreconsumo ya salen arriba como partida; aqui solo otros avisos guardados.
    ...(notifQuery.data?.guardadas ?? [])
      .filter((n) => !n.tipo.startsWith("sobreconsumo"))
      .map((n): Pendiente => ({ titulo: "Aviso", detalle: n.mensaje, to: n.obraId ? `/obras/${n.obraId}` : "/", accion: "Ver", gravedad: "info" })),
    ...(gruposSinFoto.length
      ? [
          {
            titulo: `${sinFoto.length} ${sinFoto.length === 1 ? "evidencia" : "evidencias"} sin fotos`,
            detalle: gruposSinFoto.map((g) => `${g.nombre} · ${g.fechas.join(", ")}`).join(" — "),
            to: `/obras/${gruposSinFoto[0].id}?tab=bitacora`,
            accion: "Ver",
            gravedad: "info" as const,
          },
        ]
      : []),
  ];
  const sobregiradas = pendientes.filter((p) => p.gravedad === "crit").length;

  return (
    <div className="space-y-6">
      <Encabezado titulo="Dashboard" subtitulo={`${fechaLarga(hoy)} · ${obras.length} ${obras.length === 1 ? "obra" : "obras"}`} />

      <FilaKpis>
        <Kpi label="Obras activas" valor={activas.length} nota={`de ${obras.length} obras`} />
        {verFinanciero ? (
          <>
            <Kpi label="Presupuesto" valor={pesos(presupuestoTotal)} nota="suma de partidas" />
            <Kpi label="Consumido" valor={pesos(consumidoTotal)} nota={`${Math.round(pctTotal)}% del presupuesto`} />
            <Kpi label="Disponible" valor={pesos(presupuestoTotal - consumidoTotal)} nota={`${Math.max(0, 100 - Math.round(pctTotal))}% restante`} tono="ok" />
          </>
        ) : (
          <>
            <Kpi label="Personal hoy" valor={ind ? `${ind.kpis.personalHoy.llegaron} / ${ind.kpis.personalHoy.asignados}` : "—"} nota="llegaron / asignados" />
            <Kpi label="Días-hombre" valor={ind?.kpis.diasHombre ?? "—"} nota="últimos 14 días" />
            <Kpi label="Bitácora al día" valor={ind ? `${ind.kpis.bitacoraAlDia.con} / ${ind.kpis.bitacoraAlDia.total}` : "—"} nota="días con evidencia con foto" />
          </>
        )}
        <Kpi
          label="Pendientes hoy"
          valor={pendientes.length}
          nota={sobregiradas ? `${sobregiradas} ${sobregiradas === 1 ? "partida en alerta" : "partidas en alerta"}` : pendientes.length ? "por resolver" : "todo al día"}
          tono={sobregiradas ? "crit" : pendientes.length ? "neutral" : "ok"}
        />
      </FilaKpis>

      {verFinanciero && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ListaCard titulo="Consumo por obra" subtitulo="Consumido contra presupuesto (suma de partidas)">
            <div className="space-y-4 p-4 sm:p-5">
              {obras.length === 0 && <p className="text-sm text-ink-soft">Aún no hay obras.</p>}
              {obras.map((o) => (
                <BarraConsumo
                  key={o.id}
                  etiqueta={o.nombre}
                  detalle={`${pesos(o.consumidoTotal ?? 0)} / ${pesos(o.presupuestoTotal ?? 0)}`}
                  pct={o.porcentajeConsumido ?? 0}
                  alerta={o.alertaPartida ? `${o.alertaPartida.nombre} al ${o.alertaPartida.porcentaje}%` : undefined}
                />
              ))}
            </div>
          </ListaCard>
          <ListaCard
            titulo="Gasto diario"
            subtitulo="Últimos 14 días · todas las obras"
            accion={<Leyenda items={[{ nombre: "Mano de obra", color: SERIE.azul }, { nombre: "Material", color: SERIE.naranja }, { nombre: "Otros", color: SERIE.morado }]} />}
          >
            <div className="p-4 sm:p-5">
              {ind?.gastoDiario ? (
                <ColumnasApiladas
                  titulo="Gasto diario"
                  dias={ind.dias}
                  formato={pesosCorto}
                  series={[
                    { nombre: "Mano de obra", color: SERIE.azul, valores: ind.gastoDiario.map((g) => g.manoObra) },
                    { nombre: "Material", color: SERIE.naranja, valores: ind.gastoDiario.map((g) => g.material) },
                    { nombre: "Otros", color: SERIE.morado, valores: ind.gastoDiario.map((g) => g.otros) },
                  ]}
                />
              ) : (
                <p className="text-sm text-ink-soft">Cargando…</p>
              )}
            </div>
          </ListaCard>
        </div>
      )}

      <ListaCard titulo="Personal en obra por día" subtitulo="Personas con asistencia registrada · últimos 14 días">
        <div className="p-4 sm:p-5">
          {ind ? <MapaCalor dias={ind.dias} filas={ind.personalPorDia} unidad="personas" /> : <p className="text-sm text-ink-soft">Cargando…</p>}
        </div>
      </ListaCard>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <ListaCard titulo="Obras" accion={<Link to="/obras" className="text-sm font-medium text-accent">Ver todas →</Link>} className="lg:col-span-2">
          {obras.length === 0 ? (
            <div className="p-4"><EmptyState>Aún no hay obras. Crea la primera desde la sección Obras.</EmptyState></div>
          ) : (
            <Tabla minWidth={560}>
              <thead>
                <tr>
                  <th className={th}>Obra</th>
                  <th className={th}>Estado</th>
                  {verFinanciero ? <th className={th}>Consumo</th> : <th className={th}>Hoy</th>}
                  {verFinanciero && <th className={`${th} text-right`}>Presupuesto</th>}
                </tr>
              </thead>
              <tbody>
                {obras.map((o) => (
                  <tr key={o.id} className="hover:bg-[#FAFAF8]">
                    <td className={td}>
                      <Link to={`/obras/${o.id}`} className="block font-semibold text-ink hover:text-accent">{o.nombre}</Link>
                      <span className="text-xs text-ink-soft">{[o.cliente, o.ubicacion].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className={td}><Pill tone={o.estado === "en_ejecucion" ? "info" : "neutral"}>{etiquetaEstadoObra(o.estado)}</Pill></td>
                    {verFinanciero ? (
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ECECE8]">
                            <span className="block h-full bg-steel" style={{ width: `${Math.min(100, o.porcentajeConsumido ?? 0)}%` }} />
                          </span>
                          <span className="num w-10 text-right text-xs">{Math.round(o.porcentajeConsumido ?? 0)}%</span>
                        </div>
                      </td>
                    ) : (
                      <td className={`${td} text-xs text-ink-soft`}>{o.hoy ? `${o.hoy.asistencias} asistencias · ${o.hoy.avances} evidencias` : "—"}</td>
                    )}
                    {verFinanciero && <td className={`${td} num text-right text-xs`}>{pesos(o.presupuestoTotal ?? 0)}</td>}
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </ListaCard>

        <ListaCard titulo="Pendientes de hoy" accion={<span className="num rounded-full bg-accent-soft px-2 text-xs font-semibold text-accent-ink">{pendientes.length}</span>}>
          {pendientes.length === 0 && <p className="px-5 py-4 text-sm text-ok">✓ Todo al día.</p>}
          {pendientes.map((p, i) => (
            <Link key={i} to={p.to} className="flex min-h-[44px] items-start gap-3 px-4 py-3 hover:bg-[#FAFAF8] sm:px-5">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PUNTO[p.gravedad]}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{p.titulo}</span>
                <span className="block text-xs text-ink-soft">{p.detalle}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-accent">{p.accion} →</span>
            </Link>
          ))}
        </ListaCard>
      </div>
    </div>
  );
}
