import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Asistencia, Avance } from "../lib/types";
import { Button, Card, EmptyState, Input, Label, Textarea } from "../components/ui";

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Historial() {
  const { usuario } = useAuth();
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["mi-historial"],
    queryFn: () => api.get<{ asistencias: Asistencia[]; avances: Avance[] }>("/mi-historial").then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Mi historial</h1>
        <p className="text-sm text-ink-soft">Confirma que tus registros quedaron guardados. Puedes editar las evidencias que tu registraste.</p>
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
        {query.data?.avances.length === 0 && <EmptyState>Sin evidencias registradas todavia.</EmptyState>}
        <div className="space-y-2">
          {query.data?.avances.map((a) =>
            editandoId === a.id ? (
              <EditarEvidenciaCard key={a.id} avance={a} onDone={() => setEditandoId(null)} />
            ) : (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-ink-soft">{a.fecha.slice(0, 10)}</p>
                    <p className="text-sm text-ink">{a.descripcion}</p>
                  </div>
                  {a.registradoPor === usuario?.id && (
                    <button
                      type="button"
                      onClick={() => setEditandoId(a.id)}
                      className="shrink-0 text-xs text-accent hover:underline"
                    >
                      Editar
                    </button>
                  )}
                </div>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function EditarEvidenciaCard({ avance, onDone }: { avance: Avance; onDone: () => void }) {
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(avance.fecha.slice(0, 10));
  const [descripcion, setDescripcion] = useState(avance.descripcion);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/obras/${avance.obraId}/avances/${avance.id}`, { fecha, descripcion }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mi-historial"] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card className="border-accent/40">
      <div className="max-w-[200px]">
        <Label>Fecha</Label>
        <Input type="date" max={hoyISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      <div className="mt-3">
        <Label>Descripcion</Label>
        <Textarea required rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </div>
      {error && <p className="mt-2 text-sm text-crit">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
