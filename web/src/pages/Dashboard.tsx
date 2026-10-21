import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { puedeVerFinanciero, useAuth } from "../lib/auth";
import { BarraPresupuesto } from "../components/BarraPresupuesto";
import { Notificaciones } from "../lib/types";
import { useObrasHoy } from "../lib/obrasHoy";
import { fechaCorta, hoyLocal } from "../lib/fechas";
import { Card, EmptyState, Pill } from "../components/ui";

export function Dashboard() {
  const { usuario } = useAuth();
  const verFinanciero = puedeVerFinanciero(usuario?.rol);
  const obrasQuery = useObrasHoy();
  const notifQuery = useQuery({
    queryKey: ["notificaciones"],
    queryFn: () => api.get<Notificaciones>("/notificaciones").then((r) => r.data),
  });

  const obras = obrasQuery.data ?? [];
  const activas = obras.filter((o) => o.estado === "en_ejecucion");
  const presupuestoTotal = obras.reduce((a, o) => a + (o.presupuestoTotal ?? 0), 0);
  const consumidoTotal = obras.reduce((a, o) => a + (o.consumidoTotal ?? 0), 0);

  // Las alertas de sobreconsumo son informacion financiera; se ocultan para
  // roles sin acceso financiero (Gerente de Proyecto).
  const guardadas = (notifQuery.data?.guardadas ?? []).filter((n) => verFinanciero || !n.tipo.startsWith("sobreconsumo"));

  // "Para hoy": lo que hay que resolver, cada pendiente lleva a donde se resuelve.
  const hace7 = hoyLocal(new Date(Date.now() - 7 * 864e5));
  const sinAsistencia = activas.filter((o) => o.hoy?.asistencias === 0).map((o) => ({ label: o.nombre, to: `/obras/${o.id}?tab=hoy` }));
  const sinFoto = (notifQuery.data?.avancesIncompletos ?? [])
    .filter((a) => a.fecha >= hace7)
    .map((a) => ({ label: `${a.obraNombre} · ${fechaCorta(a.fecha)}`, to: `/obras/${a.obraId}?tab=bitacora` }));
  const partidasAlerta = obras
    .filter((o) => o.alertaPartida)
    .map((o) => ({ label: `${o.nombre} · ${o.alertaPartida!.nombre} al ${o.alertaPartida!.porcentaje}%`, to: `/obras/${o.id}?tab=dinero` }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-soft">
          {verFinanciero ? "Presupuesto vs. real, siempre calculado desde transacciones." : "Estado operativo de las obras."}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Para hoy</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Pendiente titulo="Obras sin asistencia hoy" items={sinAsistencia} />
          <Pendiente titulo="Evidencias sin foto (7 días)" items={sinFoto} />
          {verFinanciero && <Pendiente titulo="Partidas al 90% o más" items={partidasAlerta} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <p className="text-xs uppercase text-ink-soft">Obras activas</p>
          <p className="mt-1 text-2xl font-semibold">{activas.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-ink-soft">Total de obras</p>
          <p className="mt-1 text-2xl font-semibold">{obras.length}</p>
        </Card>
        {verFinanciero && (
          <>
            <Card>
              <p className="text-xs uppercase text-ink-soft">Presupuesto</p>
              <p className="mt-1 text-2xl font-semibold">${presupuestoTotal.toLocaleString("es-MX")}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase text-ink-soft">Consumido</p>
              <p className="mt-1 text-2xl font-semibold">${consumidoTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</p>
            </Card>
          </>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Obras</h2>
        {obras.length === 0 ? (
          <EmptyState>Aun no hay obras. Crea la primera desde la seccion Obras.</EmptyState>
        ) : (
          <div className="space-y-2">
            {obras.map((o) => (
              <Link key={o.id} to={`/obras/${o.id}`}>
                <Card className="flex items-center justify-between gap-3 hover:border-accent/50">
                  <div>
                    <p className="font-medium text-ink">{o.nombre}</p>
                    <p className="text-xs text-ink-soft">{o.cliente} · {o.ubicacion}</p>
                  </div>
                  {verFinanciero && o.porcentajeConsumido != null && (
                    <div className="w-48 text-right">
                      <BarraPresupuesto porcentaje={o.porcentajeConsumido} alerta={o.alertaPartida} />
                      <p className="mt-1 text-xs text-ink-soft">
                        ${(o.consumidoTotal ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })} / $
                        {(o.presupuestoTotal ?? 0).toLocaleString("es-MX")}
                      </p>
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {notifQuery.data && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Alertas</h2>
          <div className="space-y-2">
            {guardadas.length === 0 &&
              notifQuery.data.sinActividad.length === 0 &&
              notifQuery.data.avancesIncompletos.length === 0 && <EmptyState>Sin alertas abiertas.</EmptyState>}
            {guardadas.map((n) => (
              <Alerta key={n.id} to={n.obraId ? `/obras/${n.obraId}?tab=dinero` : undefined} className="border-copper/40 bg-copper-soft/40">
                {n.mensaje}
              </Alerta>
            ))}
            {notifQuery.data.sinActividad.map((n, i) => (
              <Alerta key={`sa-${i}`} to={`/obras/${n.obraId}?tab=hoy`} className="border-warn/40 bg-warn-soft/40">
                {n.mensaje}
              </Alerta>
            ))}
            {notifQuery.data.avancesIncompletos.map((n, i) => (
              <Alerta key={`ai-${i}`} to={`/obras/${n.obraId}?tab=bitacora`} className="border-black/10">
                Evidencia del {fechaCorta(n.fecha)} en "{n.obraNombre}" sin fotos adjuntas
              </Alerta>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Alerta({ to, className, children }: { to?: string; className: string; children: React.ReactNode }) {
  const card = (
    <Card className={`${className} ${to ? "hover:border-accent/60" : ""}`}>
      <p className="flex items-center justify-between gap-3 text-sm text-ink">
        <span>{children}</span>
        {to && <span className="shrink-0 text-accent">Ver →</span>}
      </p>
    </Card>
  );
  return to ? <Link to={to} className="block">{card}</Link> : card;
}

// Un pendiente con su conteo: con un solo caso la tarjeta lleva directo; con
// varios, lista cada caso como enlace.
function Pendiente({ titulo, items }: { titulo: string; items: { label: string; to: string }[] }) {
  const tono = items.length === 0 ? "border-ok/30" : "border-warn/50 bg-warn-soft/40";
  const cuerpo = (
    <>
      <p className="text-[13px] text-ink-soft">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold ${items.length === 0 ? "text-ok" : "text-ink"}`}>{items.length === 0 ? "✓ 0" : items.length}</p>
    </>
  );
  if (items.length === 1)
    return (
      <Link to={items[0].to} className="block">
        <Card className={`${tono} hover:border-accent/60`}>
          {cuerpo}
          <p className="mt-1 text-[13px] text-accent">{items[0].label} →</p>
        </Card>
      </Link>
    );
  return (
    <Card className={tono}>
      {cuerpo}
      {items.length > 1 && (
        <ul className="mt-2 space-y-1">
          {items.slice(0, 5).map((it) => (
            <li key={it.to + it.label}>
              <Link to={it.to} className="text-[13px] text-accent underline-offset-2 hover:underline">
                {it.label} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
