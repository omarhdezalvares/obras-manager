import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { puedeVerFinanciero, useAuth } from "../lib/auth";
import { Notificaciones, Obra } from "../lib/types";
import { Card, EmptyState, Pill } from "../components/ui";

function pctTone(pct: number): "ok" | "warn" | "crit" {
  if (pct >= 100) return "crit";
  if (pct >= 90) return "warn";
  return "ok";
}

export function Dashboard() {
  const { usuario } = useAuth();
  const verFinanciero = puedeVerFinanciero(usuario?.rol);
  const obrasQuery = useQuery({ queryKey: ["obras"], queryFn: () => api.get<Obra[]>("/obras").then((r) => r.data) });
  const notifQuery = useQuery({
    queryKey: ["notificaciones"],
    queryFn: () => api.get<Notificaciones>("/notificaciones").then((r) => r.data),
  });

  const obras = obrasQuery.data ?? [];
  const activas = obras.filter((o) => o.estado === "en_ejecucion");
  const presupuestoTotal = obras.reduce((a, o) => a + (o.presupuestoAutorizado ?? 0), 0);
  const consumidoTotal = obras.reduce((a, o) => a + (o.consumidoTotal ?? 0), 0);

  // Las alertas de sobreconsumo son informacion financiera; se ocultan para
  // roles sin acceso financiero (Gerente de Proyecto).
  const guardadas = (notifQuery.data?.guardadas ?? []).filter((n) => verFinanciero || !n.tipo.startsWith("sobreconsumo"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-soft">
          {verFinanciero ? "Presupuesto vs. real, siempre calculado desde transacciones." : "Estado operativo de las obras."}
        </p>
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
              <p className="text-xs uppercase text-ink-soft">Presupuesto autorizado</p>
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
                    <div className="text-right">
                      <Pill tone={pctTone(o.porcentajeConsumido)}>{o.porcentajeConsumido.toFixed(0)}% consumido</Pill>
                      <p className="mt-1 text-xs text-ink-soft">
                        ${(o.consumidoTotal ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })} / $
                        {(o.presupuestoAutorizado ?? 0).toLocaleString("es-MX")}
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
              <Card key={n.id} className="border-copper/40 bg-copper-soft/40">
                <p className="text-sm text-ink">{n.mensaje}</p>
              </Card>
            ))}
            {notifQuery.data.sinActividad.map((n, i) => (
              <Card key={`sa-${i}`} className="border-warn/40 bg-warn-soft/40">
                <p className="text-sm text-ink">{n.mensaje}</p>
              </Card>
            ))}
            {notifQuery.data.avancesIncompletos.map((n, i) => (
              <Card key={`ai-${i}`} className="border-black/10">
                <p className="text-sm text-ink">{n.mensaje}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
