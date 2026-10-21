import { Link, Navigate } from "react-router-dom";
import { useObrasHoy } from "../lib/obrasHoy";
import { etiquetaEstadoObra } from "../lib/etiquetas";
import { Obra } from "../lib/types";
import { Card, EmptyState, Pill } from "../components/ui";

// Pantalla "Mis obras" (seccion 11): tarjetas grandes, no tabla; el Oficial
// solo ve las obras a las que esta explicitamente asignado (lo filtra el API).
export function MisObras() {
  const query = useObrasHoy();

  // Con una sola obra no hay nada que elegir: directo a "¿que registras hoy?".
  if (query.data?.length === 1) return <Navigate to={`/mis-obras/${query.data[0].id}`} replace />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Mis obras</h1>
        <p className="text-sm text-ink-soft">Toca una obra para registrar tu asistencia o la evidencia de hoy.</p>
      </div>

      {query.data?.length === 0 && <EmptyState>Todavia no estas asignado a ninguna obra. Pide al Administrador que te asigne.</EmptyState>}

      <div className="space-y-3">
        {query.data?.map((o) => (
          <Link key={o.id} to={`/mis-obras/${o.id}`}>
            <Card className="hover:border-accent/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-ink">{o.nombre}</p>
                  <p className="text-sm text-ink-soft">{o.cliente} · {o.ubicacion}</p>
                </div>
                <Pill>{etiquetaEstadoObra(o.estado)}</Pill>
              </div>
              {o.hoy && (
                <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
                  <span className={`rounded-full px-2.5 py-1 ${o.hoy.miLlegada ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
                    {o.hoy.miLlegada ? `✓ Llegaste ${o.hoy.miLlegada}` : "Asistencia pendiente"}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 ${o.hoy.avances > 0 ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
                    {o.hoy.avances > 0 ? "✓ Evidencia de hoy" : "Falta evidencia"}
                  </span>
                </div>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
