import { Link } from "react-router-dom";
import { HerramientaAsignacion } from "../../lib/types";
import { Card, EmptyState } from "../../components/ui";

export function HerramientasTab({ asignaciones }: { obraId: string; asignaciones: HerramientaAsignacion[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">
        Herramientas actualmente asignadas a esta obra. La asignacion/devolucion se gestiona desde{" "}
        <Link to="/herramientas" className="text-accent underline">
          el catalogo de herramientas
        </Link>
        .
      </p>
      {asignaciones.length === 0 && <EmptyState>Ninguna herramienta asignada a esta obra por ahora.</EmptyState>}
      <div className="space-y-2">
        {asignaciones.map((a) => (
          <Card key={a.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-ink">{a.herramienta?.nombre}</p>
              <p className="text-xs text-ink-soft">
                Codigo {a.herramienta?.codigo} · Custodio: {a.custodioNombre ?? a.persona?.nombreCompleto ?? "obra completa"}
              </p>
            </div>
            <p className="text-xs text-ink-soft">Desde {a.fechaAsignacion.slice(0, 10)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
