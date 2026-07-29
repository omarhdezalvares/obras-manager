import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { HerramientaAsignacion } from "../lib/types";
import { Card, EmptyState } from "../components/ui";

// Pantalla "Ver herramientas asignadas" (seccion 11): lista simple con
// estado, sin acciones de edicion para el rol Oficial.
export function MisHerramientas() {
  const query = useQuery({
    queryKey: ["herramientas-mias"],
    queryFn: () => api.get<HerramientaAsignacion[]>("/herramientas/mias").then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Mis herramientas</h1>
        <p className="text-sm text-ink-soft">Lo asignado a tu nombre, mas lo asignado a las obras de las que eres responsable.</p>
      </div>

      {query.data?.length === 0 && <EmptyState>No tienes herramientas bajo tu custodia por ahora.</EmptyState>}

      <div className="space-y-2">
        {query.data?.map((a) => (
          <Card key={a.id}>
            <p className="font-medium text-ink">{a.herramienta?.nombre}</p>
            <p className="text-xs text-ink-soft">Codigo {a.herramienta?.codigo}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {a.personaId ? "En mi poder" : `En la obra: ${a.obra?.nombre}`} · desde {a.fechaAsignacion.slice(0, 10)}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
