import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../../lib/api";
import { Asistencia, ObraPersona, Obra } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { Button, Card, Input } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";
import { Confirmacion } from "../../components/Confirmacion";
import { FechaHoy } from "../../components/FechaHoy";
import { useObrasHoy } from "../../lib/obrasHoy";
import { hoyLocal, horaLocal } from "../../lib/fechas";
import { horasRegistradasEnFecha, seleccionInicial } from "../../lib/asistencias";

interface ObraConPersonas extends Obra {
  obraPersonas: ObraPersona[];
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

  const [fecha, setFecha] = useState(hoyLocal());
  const [horas, setHoras] = useState<Record<string, string>>({});
  // null = el usuario aun no toca la lista: se usa la preseleccion (llega con la obra).
  const [seleccionTocada, setSeleccion] = useState<Set<string> | null>(null);
  const [paso, setPaso] = useState<"seleccion" | "listo">("seleccion");
  const [resultado, setResultado] = useState<
    { personaId: string; ok: boolean; motivo?: string; asistenciaId?: string }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const asistenciasDia = useQuery({
    queryKey: ["asistencias", obraId, fecha],
    queryFn: () =>
      api.get<Asistencia[]>(`/obras/${obraId}/asistencias`, { params: { fecha_desde: fecha, fecha_hasta: fecha } }).then((r) => r.data),
    enabled: !!obraId,
  });
  const obraPersonas = obraQuery.data?.obraPersonas ?? [];
  const seleccion = seleccionTocada ?? seleccionInicial(usuario?.personaId, obraPersonas);
  const yaRegistradas = horasRegistradasEnFecha(asistenciasDia.data, fecha);
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
      setPaso("listo");
      qc.invalidateQueries({ queryKey: ["obras", "hoy"] });
      qc.invalidateQueries({ queryKey: ["asistencias", obraId] });
      qc.invalidateQueries({ queryKey: ["mi-historial"] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function toggle(personaId: string) {
    setSeleccion(() => {
      const next = new Set(seleccion);
      if (next.has(personaId)) next.delete(personaId);
      else next.add(personaId);
      return next;
    });
    setHoras((prev) => (prev[personaId] ? prev : { ...prev, [personaId]: horaLocal() }));
  }

  const misAsistenciasOk = resultado?.filter((r) => r.ok) ?? [];
  const obrasHoy = useObrasHoy();
  const faltaEvidencia = obrasHoy.data?.find((o) => o.id === obraId)?.hoy?.avances === 0;

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/mis-obras/${obraId}`} className="text-sm text-accent">
          ← {obraQuery.data?.nombre ?? "Regresar"}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-ink">Registrar asistencia</h1>
      </div>

      {paso === "seleccion" && (
        <Card>
          <p className="mb-3 text-sm text-ink-soft">Marca quiénes llegaron y la fecha. La hora se precarga pero puedes ajustarla.</p>

          <div className="mb-3">
            <FechaHoy value={fecha} onChange={setFecha} />
          </div>

          {obraPersonas.length === 0 ? (
            <p className="text-sm text-ink-soft">No hay personas asignadas a esta obra todavía.</p>
          ) : (
            <div className="space-y-2">
              {obraPersonas.map((op) => {
                const horaRegistrada = yaRegistradas.get(op.personaId);
                const marcado = !horaRegistrada && seleccion.has(op.personaId);
                return (
                <label
                  key={op.id}
                  className={`flex min-h-[52px] items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                    horaRegistrada ? "border-black/10 bg-black/5 opacity-60" : marcado ? "border-accent bg-accent-soft" : "border-black/10"
                  }`}
                >
                  <span className="flex items-center gap-3 text-base">
                    <input
                      type="checkbox"
                      className="h-6 w-6"
                      checked={marcado}
                      disabled={!!horaRegistrada}
                      onChange={() => toggle(op.personaId)}
                    />
                    <span>
                      {op.persona.nombreCompleto}
                      {horaRegistrada && <span className="block text-[13px] text-ink-soft">Ya registrada (llegada {horaRegistrada})</span>}
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

          <Button className="mt-4 w-full" disabled={aEnviar.length === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Guardando…" : `Guardar asistencia (${aEnviar.length})`}
          </Button>
        </Card>
      )}

      {paso === "listo" && (
        <div className="space-y-3">
          <Confirmacion
            titulo={misAsistenciasOk.length > 0 ? `Asistencia guardada (${misAsistenciasOk.length})` : "No se guardó ninguna asistencia"}
            detalle={resultado?.map((r) => {
              const persona = obraPersonas.find((op) => op.personaId === r.personaId)?.persona;
              const hora = horas[r.personaId];
              return (
                <p key={r.personaId} className={r.ok ? "text-ok" : "text-crit"}>
                  {r.ok ? "✓" : "✗"} {persona?.nombreCompleto}
                  {r.ok ? (hora ? ` · ${hora}` : "") : `: ${r.motivo}`}
                </p>
              );
            })}
            accion={faltaEvidencia ? { label: "Registrar evidencia de hoy", to: `/mis-obras/${obraId}/evidencia` } : undefined}
          />

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
