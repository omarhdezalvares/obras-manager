import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Obra } from "../lib/types";
import { Card, EmptyState, Pill } from "../components/ui";

const ESTADO_LABEL: Record<Obra["estado"], string> = {
  planeada: "Planeada",
  en_ejecucion: "En ejecucion",
  pausada: "Pausada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

// Pantalla "Mis obras" (seccion 11): tarjetas grandes, no tabla; el Oficial
// solo ve las obras a las que esta explicitamente asignado (lo filtra el API).
export function MisObras() {
  const query = useQuery({ queryKey: ["obras"], queryFn: () => api.get<Obra[]>("/obras").then((r) => r.data) });

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
                <Pill>{ESTADO_LABEL[o.estado]}</Pill>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
