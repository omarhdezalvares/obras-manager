import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { Avance } from "../../lib/types";
import { Button, Card, EmptyState, Input, Label, Pill, Textarea, filaLista, lista } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";
import { fechaCorta, hoyLocal } from "../../lib/fechas";

function descargarBlob(data: BlobPart, tipo: string, nombreArchivo: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AvancesTab({
  obraId,
  obraNombre,
  puedeOperar,
  esAdmin,
  registrarAlAbrir,
}: {
  obraId: string;
  obraNombre: string;
  puedeOperar: boolean;
  esAdmin: boolean;
  registrarAlAbrir?: boolean;
}) {
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(hoyLocal());
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [errorFotos, setErrorFotos] = useState<string | null>(null);
  const [descargandoFotos, setDescargandoFotos] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(!!registrarAlAbrir);
  const [mostrarPdf, setMostrarPdf] = useState(false);

  const query = useQuery({
    queryKey: ["avances", obraId],
    queryFn: () => api.get<Avance[]>(`/obras/${obraId}/avances`).then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: () => api.post(`/obras/${obraId}/avances`, { fecha, descripcion }),
    onSuccess: (res) => {
      setDescripcion("");
      setFecha(hoyLocal());
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

  async function descargarFotos() {
    setErrorFotos(null);
    setDescargandoFotos(true);
    try {
      const res = await api.get(`/obras/${obraId}/avances/fotos.zip`, { responseType: "blob" });
      descargarBlob(res.data, "application/zip", `fotos-${obraNombre.replace(/[^a-z0-9]+/gi, "-")}-${hoyLocal()}.zip`);
    } catch (err) {
      setErrorFotos(apiErrorMessage(err));
    } finally {
      setDescargandoFotos(false);
    }
  }

  // Historial primero; capturar y el PDF se abren desde el encabezado.
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Evidencias</h2>
        <div className="flex flex-wrap gap-2">
          {puedeOperar && (
            <Button onClick={() => setMostrarForm((v) => !v)}>{mostrarForm ? "Cancelar" : "+ Registrar evidencia"}</Button>
          )}
          {esAdmin && (
            <Button variant="secondary" onClick={() => setMostrarPdf((v) => !v)}>
              {mostrarPdf ? "Cerrar reporte" : "Descargar reporte PDF"}
            </Button>
          )}
          <Button variant="secondary" onClick={descargarFotos} disabled={descargandoFotos}>
            {descargandoFotos ? "Descargando…" : "Descargar todas las fotos"}
          </Button>
        </div>
      </div>
      {errorFotos && <p className="text-sm text-crit">{errorFotos}</p>}

      {puedeOperar && (mostrarForm || ultimoId) && (
        <Card>
          <h2 className="mb-1 font-semibold text-ink">Registrar evidencia</h2>
          <p className="mb-3 text-xs text-ink-soft">
            Selecciona la fecha y describe lo realizado. Se vincula automaticamente con las personas que registraron
            asistencia ese dia en esta obra.
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="max-w-[200px]">
              <Label>Fecha</Label>
              <Input type="date" max={hoyLocal()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <Textarea
              required
              rows={3}
              placeholder="Que se hizo ese dia..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            {error && <p className="text-sm text-crit">{error}</p>}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : "Guardar evidencia"}
            </Button>
          </form>
          {ultimoId && (
            <div className="mt-3 border-t border-black/10 pt-3">
              <p className="mb-2 text-xs text-ink-soft">Adjunta fotos de la evidencia recien guardada:</p>
              <EvidenceUploader entidadTipo="avance" entidadId={ultimoId} />
            </div>
          )}
        </Card>
      )}

      {esAdmin && mostrarPdf && <ReportePdfCard obraId={obraId} obraNombre={obraNombre} />}

      <div>
        {query.data?.length === 0 && <EmptyState>Aun no hay evidencias registradas en esta obra.</EmptyState>}
        <div className={lista}>
          {query.data?.map((a) =>
            editandoId === a.id ? (
              <EditarEvidenciaCard
                key={a.id}
                obraId={obraId}
                avance={a}
                onDone={() => setEditandoId(null)}
              />
            ) : (
              <div key={a.id} className={filaLista}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-ink-soft">{fechaCorta(a.fecha)}</p>
                    <p className="text-sm text-ink">{a.descripcion}</p>
                    {a.avancePersonas.length > 0 && (
                      <p className="mt-1 text-xs text-ink-soft">
                        Presentes: {a.avancePersonas.map((ap) => ap.persona.nombreCompleto).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.incompleto && <Pill tone="warn">Sin fotos</Pill>}
                    {puedeOperar && (
                      <button
                        type="button"
                        onClick={() => setEditandoId(a.id)}
                        className="min-h-[44px] rounded-md px-3 text-sm text-accent hover:bg-accent-soft"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <EvidenceUploader entidadTipo="avance" entidadId={a.id} compact />
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function EditarEvidenciaCard({ obraId, avance, onDone }: { obraId: string; avance: Avance; onDone: () => void }) {
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(avance.fecha.slice(0, 10));
  const [descripcion, setDescripcion] = useState(avance.descripcion);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/obras/${obraId}/avances/${avance.id}`, { fecha, descripcion }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["avances", obraId] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card className="border-accent/40">
      <div className="max-w-[200px]">
        <Label>Fecha</Label>
        <Input type="date" max={hoyLocal()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
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

function ReportePdfCard({ obraId, obraNombre }: { obraId: string; obraNombre: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);

  async function generarPdf() {
    setError(null);
    setGenerando(true);
    try {
      const res = await api.get(`/obras/${obraId}/avances/reporte-pdf`, {
        params: { desde: desde || undefined, hasta: hasta || undefined },
        responseType: "blob",
      });
      descargarBlob(res.data, "application/pdf", `evidencias-${obraNombre.replace(/[^a-z0-9]+/gi, "-")}-${hoyLocal()}.pdf`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold text-ink">Reporte de evidencias para el cliente</h2>
      <p className="mb-3 text-xs text-ink-soft">
        Genera un PDF con formato profesional: encabezado de la obra y las evidencias dia por dia con su descripcion
        y fotos, listo para enviarlo al cliente. Filtra por fecha o dejalo vacio para incluir todo el historial.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label>Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} max={hasta || undefined} />
        </div>
        <div>
          <Label>Hasta</Label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} min={desde || undefined} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-crit">{error}</p>}
      <Button variant="secondary" className="mt-3" onClick={generarPdf} disabled={generando}>
        {generando ? "Generando…" : "Descargar reporte PDF"}
      </Button>
    </Card>
  );
}
