import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { Asistencia, ObraPersona } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { Button, Card, EmptyState, Input, Label } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";
import { horasRegistradasEnFecha } from "../../lib/asistencias";
import { hoyLocal, horaLocal } from "../../lib/fechas";

export function AsistenciasTab({
  obraId,
  obraPersonas,
  puedeOperar,
  puedeEditar,
  verFinanciero,
}: {
  obraId: string;
  obraPersonas: ObraPersona[];
  puedeOperar: boolean;
  puedeEditar: boolean;
  verFinanciero: boolean;
}) {
  const qc = useQueryClient();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["asistencias", obraId],
    queryFn: () => api.get<Asistencia[]>(`/obras/${obraId}/asistencias`).then((r) => r.data),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.delete(`/obras/${obraId}/asistencias/${id}`),
    onSuccess: () => invalidarAsistencias(qc, obraId),
    onError: (err) => alert(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      {puedeOperar && (
        <RegistrarAsistencia obraId={obraId} obraPersonas={obraPersonas} verFinanciero={verFinanciero} asistencias={query.data} />
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Historial</h2>
        {query.data?.length === 0 && <EmptyState>Aun no hay asistencias registradas en esta obra.</EmptyState>}
        <div className="space-y-2">
          {query.data?.map((a) => (
            <Card key={a.id}>
              {editandoId === a.id ? (
                <EditarAsistenciaForm obraId={obraId} asistencia={a} onDone={() => setEditandoId(null)} />
              ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{a.persona?.nombreCompleto}</p>
                  <p className="text-xs text-ink-soft">
                    {a.fecha.slice(0, 10)} · llegada {a.horaLlegada}
                    {verFinanciero && a.transaccion && ` · costo aplicado $${a.transaccion.monto.toLocaleString("es-MX")}`}
                  </p>
                  {a.observaciones && <p className="text-xs text-ink-soft">{a.observaciones}</p>}
                </div>
                {puedeEditar && (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setEditandoId(a.id)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-crit"
                      disabled={eliminar.isPending}
                      onClick={() => {
                        if (confirm(`¿Eliminar la asistencia de ${a.persona?.nombreCompleto} del ${a.fecha.slice(0, 10)}? Se quitara su costo de mano de obra y sus fotos.`))
                          eliminar.mutate(a.id);
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                )}
              </div>
              )}
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

// Una asistencia arrastra su costo de mano de obra: refrescar tambien
// transacciones y el detalle de obra (presupuesto consumido).
function invalidarAsistencias(qc: ReturnType<typeof useQueryClient>, obraId: string) {
  qc.invalidateQueries({ queryKey: ["asistencias", obraId] });
  qc.invalidateQueries({ queryKey: ["transacciones", obraId] });
  qc.invalidateQueries({ queryKey: ["obra", obraId] });
}

function EditarAsistenciaForm({ obraId, asistencia, onDone }: { obraId: string; asistencia: Asistencia; onDone: () => void }) {
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(asistencia.fecha.slice(0, 10));
  const [horaLlegada, setHora] = useState(asistencia.horaLlegada);
  const [observaciones, setObservaciones] = useState(asistencia.observaciones ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/obras/${obraId}/asistencias/${asistencia.id}`, { fecha, horaLlegada, observaciones }),
    onSuccess: () => {
      invalidarAsistencias(qc, obraId);
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
      className="space-y-3"
    >
      <p className="font-medium text-ink">Editar asistencia · {asistencia.persona?.nombreCompleto}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <Label>Fecha</Label>
          <Input type="date" required max={hoyLocal()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <Label>Hora de llegada</Label>
          <Input type="time" required value={horaLlegada} onChange={(e) => setHora(e.target.value)} />
        </div>
        <div>
          <Label>Observaciones</Label>
          <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-crit">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function RegistrarAsistencia({
  obraId,
  obraPersonas,
  verFinanciero,
  asistencias,
}: {
  obraId: string;
  obraPersonas: ObraPersona[];
  verFinanciero: boolean;
  asistencias: Asistencia[] | undefined;
}) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(hoyLocal());
  const [horas, setHoras] = useState<Record<string, string>>({});
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(usuario?.personaId ? [usuario.personaId] : []));
  const [resultado, setResultado] = useState<{ personaId: string; ok: boolean; motivo?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yaRegistradas = horasRegistradasEnFecha(asistencias, fecha);
  // Quien ya tiene asistencia ese dia no se envia aunque haya quedado
  // seleccionado (p. ej. la preseleccion del propio usuario o un cambio de fecha).
  const aEnviar = Array.from(seleccion).filter((id) => !yaRegistradas.has(id));

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/obras/${obraId}/asistencias`, {
        fecha,
        registros: aEnviar.map((personaId) => ({
          personaId,
          horaLlegada: horas[personaId] ?? horaLocal(),
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
    setHoras((prev) => (prev[personaId] ? prev : { ...prev, [personaId]: horaLocal() }));
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold text-ink">Registrar asistencia</h2>
      <p className="mb-3 text-xs text-ink-soft">
        Selecciona las personas presentes y la fecha. La hora se precarga con la hora actual del dispositivo pero es editable.
      </p>
      <div className="mb-3 max-w-[200px]">
        <Input type="date" max={hoyLocal()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      {obraPersonas.length === 0 ? (
        <p className="text-sm text-ink-soft">No hay personas asignadas a esta obra todavia.</p>
      ) : (
        <div className="space-y-2">
          {obraPersonas.map((op) => {
            const horaRegistrada = yaRegistradas.get(op.personaId);
            const marcado = !horaRegistrada && seleccion.has(op.personaId);
            return (
            <label
              key={op.id}
              className={`flex min-h-[44px] items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                horaRegistrada ? "border-black/10 bg-black/5 opacity-60" : marcado ? "border-accent bg-accent-soft" : "border-black/10"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={marcado}
                  disabled={!!horaRegistrada}
                  onChange={() => toggle(op.personaId)}
                />
                <span>
                  {op.persona.nombreCompleto}
                  {verFinanciero && op.costoDiarioObra != null && (
                    <span className="ml-1 text-xs text-copper">· costo por proyecto ${op.costoDiarioObra}</span>
                  )}
                  {horaRegistrada && <span className="ml-1 text-xs text-ink-soft">· Ya registrada (llegada {horaRegistrada})</span>}
                </span>
              </span>
              {marcado && (
                <Input
                  type="time"
                  className="w-28"
                  value={horas[op.personaId] ?? horaLocal()}
                  onChange={(e) => setHoras((prev) => ({ ...prev, [op.personaId]: e.target.value }))}
                />
              )}
            </label>
            );
          })}
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

      <Button className="mt-3" disabled={aEnviar.length === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? "Guardando…" : `Guardar asistencia (${aEnviar.length})`}
      </Button>
    </Card>
  );
}
