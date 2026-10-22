import { Link } from "react-router-dom";
import { HerramientaAsignacion } from "../../lib/types";
import { Card, EmptyState, filaLista, lista } from "../../components/ui";
import { fechaCortaDe } from "../../lib/fechas";

export function HerramientasTab({ asignaciones }: { obraId: string; asignaciones: HerramientaAsignacion[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-ink">Herramientas en la obra</h2>
      <p className="text-xs text-ink-soft">
        Herramientas actualmente asignadas a esta obra. La asignacion/devolucion se gestiona desde{" "}
        <Link to="/herramientas" className="text-accent underline">
          el catalogo de herramientas
        </Link>
        .
      </p>
      {asignaciones.length === 0 && <EmptyState>Ninguna herramienta asignada a esta obra por ahora.</EmptyState>}
      <div className={lista}>
        {asignaciones.map((a) => (
          <div key={a.id} className={`${filaLista} flex items-center justify-between`}>
            <div>
              <p className="font-medium text-ink">{a.herramienta?.nombre}</p>
              <p className="text-xs text-ink-soft">
                Codigo {a.herramienta?.codigo} · Custodio: {a.custodioNombre ?? a.persona?.nombreCompleto ?? "obra completa"}
              </p>
            </div>
            <p className="text-xs text-ink-soft">Desde {fechaCortaDe(a.fechaAsignacion)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
