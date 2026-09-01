import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { Asistencia, ObraPersona } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { Button, Card, EmptyState, Input } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function ahoraHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AsistenciasTab({
  obraId,
  obraPersonas,
  puedeOperar,
  verFinanciero,
}: {
  obraId: string;
  obraPersonas: ObraPersona[];
  puedeOperar: boolean;
  verFinanciero: boolean;
}) {
  const query = useQuery({
    queryKey: ["asistencias", obraId],
    queryFn: () => api.get<Asistencia[]>(`/obras/${obraId}/asistencias`).then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      {puedeOperar && <RegistrarAsistencia obraId={obraId} obraPersonas={obraPersonas} verFinanciero={verFinanciero} />}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Historial</h2>
        {query.data?.length === 0 && <EmptyState>Aun no hay asistencias registradas en esta obra.</EmptyState>}
        <div className="space-y-2">
          {query.data?.map((a) => (
            <Card key={a.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{a.persona?.nombreCompleto}</p>
                  <p className="text-xs text-ink-soft">
                    {a.fecha.slice(0, 10)} · llegada {a.horaLlegada}
                    {verFinanciero && a.transaccion && ` · costo aplicado $${a.transaccion.monto.toLocaleString("es-MX")}`}
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <EvidenceUploader entidadTipo="asistencia" entidadId={a.id} compact />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function RegistrarAsistencia({
  obraId,
  obraPersonas,
  verFinanciero,
}: {
  obraId: string;
  obraPersonas: ObraPersona[];
  verFinanciero: boolean;
}) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(hoyISO());
  const [horas, setHoras] = useState<Record<string, string>>({});
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(usuario?.personaId ? [usuario.personaId] : []));
  const [resultado, setResultado] = useState<{ personaId: string; ok: boolean; motivo?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/obras/${obraId}/asistencias`, {
        fecha,
        registros: Array.from(seleccion).map((personaId) => ({
          personaId,
          horaLlegada: horas[personaId] ?? ahoraHHmm(),
        })),
      }),
    onSuccess: (res) => {
      setResultado(res.data.resultados);
      qc.invalidateQueries({ queryKey: ["asistencias", obraId] });
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

  return (
    <Card>
      <h2 className="mb-1 font-semibold text-ink">Registrar asistencia</h2>
      <p className="mb-3 text-xs text-ink-soft">
        Selecciona las personas presentes y la fecha. La hora se precarga con la hora actual del dispositivo pero es editable.
      </p>
      <div className="mb-3 max-w-[200px]">
        <Input type="date" max={hoyISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      {obraPersonas.length === 0 ? (
        <p className="text-sm text-ink-soft">No hay personas asignadas a esta obra todavia.</p>
      ) : (
        <div className="space-y-2">
          {obraPersonas.map((op) => (
            <label
              key={op.id}
              className={`flex min-h-[44px] items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                seleccion.has(op.personaId) ? "border-accent bg-accent-soft" : "border-black/10"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={seleccion.has(op.personaId)}
                  onChange={() => toggle(op.personaId)}
                />
                <span>
                  {op.persona.nombreCompleto}
                  {verFinanciero && op.costoDiarioObra != null && (
                    <span className="ml-1 text-xs text-copper">· costo por proyecto ${op.costoDiarioObra}</span>
                  )}
                </span>
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

      {resultado && (
        <div className="mt-3 space-y-1">
          {resultado.map((r) => {
            const persona = obraPersonas.find((op) => op.personaId === r.personaId)?.persona;
            return (
              <p key={r.personaId} className={`text-xs ${r.ok ? "text-ok" : "text-crit"}`}>
                {r.ok ? "✓" : "✗"} {persona?.nombreCompleto}: {r.ok ? "registrada" : r.motivo}
              </p>
            );
          })}
        </div>
      )}

      <Button className="mt-3" disabled={seleccion.size === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? "Guardando…" : `Guardar asistencia (${seleccion.size})`}
      </Button>
    </Card>
  );
}
