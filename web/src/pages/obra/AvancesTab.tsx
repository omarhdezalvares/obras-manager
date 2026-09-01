import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { Avance } from "../../lib/types";
import { Button, Card, EmptyState, Input, Label, Pill, Textarea } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

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
}: {
  obraId: string;
  obraNombre: string;
  puedeOperar: boolean;
  esAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [errorFotos, setErrorFotos] = useState<string | null>(null);
  const [descargandoFotos, setDescargandoFotos] = useState(false);

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

  async function descargarFotos() {
    setErrorFotos(null);
    setDescargandoFotos(true);
    try {
      const res = await api.get(`/obras/${obraId}/avances/fotos.zip`, { responseType: "blob" });
      descargarBlob(res.data, "application/zip", `fotos-${obraNombre.replace(/[^a-z0-9]+/gi, "-")}-${hoyISO()}.zip`);
    } catch (err) {
      setErrorFotos(apiErrorMessage(err));
    } finally {
      setDescargandoFotos(false);
    }
  }

  return (
    <div className="space-y-4">
      {puedeOperar && (
        <Card>
          <h2 className="mb-1 font-semibold text-ink">Registrar evidencia — {hoyISO()}</h2>
          <p className="mb-3 text-xs text-ink-soft">
            Se vincula automaticamente con las personas que registraron asistencia hoy en esta obra.
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <Textarea
              required
              rows={3}
              placeholder="Que se hizo hoy..."
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

      {esAdmin && <ReportePdfCard obraId={obraId} obraNombre={obraNombre} />}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Historial</h2>
          <Button variant="secondary" onClick={descargarFotos} disabled={descargandoFotos}>
            {descargandoFotos ? "Descargando…" : "Descargar todas las fotos"}
          </Button>
        </div>
        {errorFotos && <p className="mb-2 text-sm text-crit">{errorFotos}</p>}
        {query.data?.length === 0 && <EmptyState>Aun no hay evidencias registradas en esta obra.</EmptyState>}
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
      descargarBlob(res.data, "application/pdf", `evidencias-${obraNombre.replace(/[^a-z0-9]+/gi, "-")}-${hoyISO()}.pdf`);
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
