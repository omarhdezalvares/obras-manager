import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Asistencia, Avance } from "../lib/types";
import { Card, EmptyState } from "../components/ui";

// "Historial basico" (seccion 11): linea de tiempo solo lectura para
// confirmar "si quedo guardado".
export function Historial() {
  const query = useQuery({
    queryKey: ["mi-historial"],
    queryFn: () => api.get<{ asistencias: Asistencia[]; avances: Avance[] }>("/mi-historial").then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Mi historial</h1>
        <p className="text-sm text-ink-soft">Solo lectura — confirma que tus registros quedaron guardados.</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Asistencias recientes</h2>
        {query.data?.asistencias.length === 0 && <EmptyState>Sin asistencias registradas todavia.</EmptyState>}
        <div className="space-y-2">
          {query.data?.asistencias.map((a) => (
            <Card key={a.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{a.obra?.nombre}</p>
                <p className="text-xs text-ink-soft">{a.fecha.slice(0, 10)} · llegada {a.horaLlegada}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Evidencias recientes</h2>
        {query.data?.avances.length === 0 && <EmptyState>Sin avances registrados todavia.</EmptyState>}
        <div className="space-y-2">
          {query.data?.avances.map((a) => (
            <Card key={a.id}>
              <p className="text-xs text-ink-soft">{a.fecha.slice(0, 10)}</p>
              <p className="text-sm text-ink">{a.descripcion}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
