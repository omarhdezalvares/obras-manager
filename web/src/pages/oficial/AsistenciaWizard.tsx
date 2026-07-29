import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../../lib/api";
import { ObraPersona, Obra } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { Button, Card, Input } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";

interface ObraConPersonas extends Obra {
  obraPersonas: ObraPersona[];
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function ahoraHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Paso 2 del flujo de campo: solo lo necesario para asistencia. La foto es
// opcional (a diferencia de Evidencia, donde es obligatoria).
export function AsistenciaWizard() {
  const { obraId } = useParams<{ obraId: string }>();
  const { usuario } = useAuth();
  const qc = useQueryClient();

  const obraQuery = useQuery({
    queryKey: ["obra", obraId],
    queryFn: () => api.get<ObraConPersonas>(`/obras/${obraId}`).then((r) => r.data),
    enabled: !!obraId,
  });

  const [horas, setHoras] = useState<Record<string, string>>({});
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(usuario?.personaId ? [usuario.personaId] : []));
  const [paso, setPaso] = useState<"seleccion" | "listo">("seleccion");
  const [resultado, setResultado] = useState<
    { personaId: string; ok: boolean; motivo?: string; asistenciaId?: string }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/obras/${obraId}/asistencias`, {
        fecha: hoyISO(),
        registros: Array.from(seleccion).map((personaId) => ({
          personaId,
          horaLlegada: horas[personaId] ?? ahoraHHmm(),
        })),
      }),
    onSuccess: (res) => {
      setResultado(res.data.resultados);
      setPaso("listo");
      qc.invalidateQueries({ queryKey: ["asistencias", obraId] });
      qc.invalidateQueries({ queryKey: ["mi-historial"] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function toggle(personaId: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) next.delete(personaId);
      else next.add(personaId);
      return next;
    });
    setHoras((prev) => (prev[personaId] ? prev : { ...prev, [personaId]: ahoraHHmm() }));
  }

  const obraPersonas = obraQuery.data?.obraPersonas ?? [];
  const misAsistenciasOk = resultado?.filter((r) => r.ok) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/mis-obras/${obraId}`} className="text-sm text-accent">
          ← {obraQuery.data?.nombre ?? "Regresar"}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-ink">Registrar asistencia — {hoyISO()}</h1>
      </div>

      {paso === "seleccion" && (
        <Card>
          <p className="mb-3 text-sm text-ink-soft">Marca quiénes llegaron hoy. La hora se precarga pero puedes ajustarla.</p>

          {obraPersonas.length === 0 ? (
            <p className="text-sm text-ink-soft">No hay personas asignadas a esta obra todavía.</p>
          ) : (
            <div className="space-y-2">
              {obraPersonas.map((op) => (
                <label
                  key={op.id}
                  className={`flex min-h-[52px] items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                    seleccion.has(op.personaId) ? "border-accent bg-accent-soft" : "border-black/10"
                  }`}
                >
                  <span className="flex items-center gap-3 text-base">
                    <input
                      type="checkbox"
                      className="h-6 w-6"
                      checked={seleccion.has(op.personaId)}
                      onChange={() => toggle(op.personaId)}
                    />
                    {op.persona.nombreCompleto}
                  </span>
                  {seleccion.has(op.personaId) && (
                    <Input
                      type="time"
                      className="w-28"
                      value={horas[op.personaId] ?? ahoraHHmm()}
                      onChange={(e) => setHoras((prev) => ({ ...prev, [op.personaId]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          {error && <p className="mt-2 text-sm text-crit">{error}</p>}

          <Button className="mt-4 w-full" disabled={seleccion.size === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Guardando…" : `Guardar asistencia (${seleccion.size})`}
          </Button>
        </Card>
      )}

      {paso === "listo" && (
        <div className="space-y-3">
          <Card className="border-ok/40 bg-ok-soft/40">
            <p className="font-medium text-ink">Asistencia guardada</p>
            {resultado?.map((r) => {
              const persona = obraPersonas.find((op) => op.personaId === r.personaId)?.persona;
              return (
                <p key={r.personaId} className={`text-sm ${r.ok ? "text-ok" : "text-crit"}`}>
                  {r.ok ? "✓" : "✗"} {persona?.nombreCompleto}: {r.ok ? "registrada" : r.motivo}
                </p>
              );
            })}
          </Card>

          {misAsistenciasOk.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-medium text-ink">Foto (opcional)</p>
              <div className="space-y-3">
                {misAsistenciasOk.map((r) => {
                  const persona = obraPersonas.find((op) => op.personaId === r.personaId)?.persona;
                  if (!r.asistenciaId) return null;
                  return (
                    <div key={r.personaId}>
                      <p className="mb-1 text-xs text-ink-soft">{persona?.nombreCompleto}</p>
                      <EvidenceUploader entidadTipo="asistencia" entidadId={r.asistenciaId} compact />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="flex gap-2">
            <Link to={`/mis-obras/${obraId}`} className="flex-1">
              <Button variant="secondary" className="w-full">
                Terminar
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
