import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { Avance } from "../../lib/types";
import { Button, Card, EmptyState, Pill, Textarea } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AvancesTab({ obraId, puedeOperar }: { obraId: string; puedeOperar: boolean }) {
  const qc = useQueryClient();
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ultimoId, setUltimoId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["avances", obraId],
    queryFn: () => api.get<Avance[]>(`/obras/${obraId}/avances`).then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: () => api.post(`/obras/${obraId}/avances`, { fecha: hoyISO(), descripcion }),
    onSuccess: (res) => {
      setDescripcion("");
      setUltimoId(res.data.id);
      qc.invalidateQueries({ queryKey: ["avances", obraId] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="space-y-4">
      {puedeOperar && (
        <Card>
          <h2 className="mb-1 font-semibold text-ink">Registrar avance — {hoyISO()}</h2>
          <p className="mb-3 text-xs text-ink-soft">
            Se vincula automaticamente con las personas que registraron asistencia hoy en esta obra.
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <Textarea
              required
              rows={3}
              placeholder="Que se avanzo hoy..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            {error && <p className="text-sm text-crit">{error}</p>}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : "Guardar avance"}
            </Button>
          </form>
          {ultimoId && (
            <div className="mt-3 border-t border-black/10 pt-3">
              <p className="mb-2 text-xs text-ink-soft">Adjunta fotos del avance recien guardado:</p>
              <EvidenceUploader entidadTipo="avance" entidadId={ultimoId} />
            </div>
          )}
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Historial</h2>
        {query.data?.length === 0 && <EmptyState>Aun no hay avances registrados en esta obra.</EmptyState>}
        <div className="space-y-2">
          {query.data?.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-soft">{a.fecha.slice(0, 10)}</p>
                  <p className="text-sm text-ink">{a.descripcion}</p>
                  {a.avancePersonas.length > 0 && (
                    <p className="mt-1 text-xs text-ink-soft">
                      Presentes: {a.avancePersonas.map((ap) => ap.persona.nombreCompleto).join(", ")}
                    </p>
                  )}
                </div>
                {a.incompleto && <Pill tone="warn">Sin fotos</Pill>}
              </div>
              <div className="mt-2">
                <EvidenceUploader entidadTipo="avance" entidadId={a.id} compact />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
