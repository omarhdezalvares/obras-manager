import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../../lib/api";
import { Evidencia, Obra } from "../../lib/types";
import { Button, Card, Input, Label, Textarea } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Paso 2 del flujo de campo para "Evidencia" (antes "Avance"): la fecha de
// registro es editable (a peticion del usuario) y al menos una foto es
// obligatoria antes de poder finalizar.
export function EvidenciaWizard() {
  const { obraId } = useParams<{ obraId: string }>();
  const qc = useQueryClient();

  const obraQuery = useQuery({
    queryKey: ["obra", obraId],
    queryFn: () => api.get<Obra>(`/obras/${obraId}`).then((r) => r.data),
    enabled: !!obraId,
  });

  const [fecha, setFecha] = useState(hoyISO());
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [avanceId, setAvanceId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post(`/obras/${obraId}/avances`, { fecha, descripcion }),
    onSuccess: (res) => {
      setAvanceId(res.data.id);
      qc.invalidateQueries({ queryKey: ["avances", obraId] });
      qc.invalidateQueries({ queryKey: ["mi-historial"] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const evidenciasQuery = useQuery({
    queryKey: ["evidencias", "avance", avanceId],
    queryFn: () => api.get<Evidencia[]>("/evidencias", { params: { entidadTipo: "avance", entidadId: avanceId } }).then((r) => r.data),
    enabled: !!avanceId,
  });
  const tieneFoto = (evidenciasQuery.data?.length ?? 0) > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/mis-obras/${obraId}`} className="text-sm text-accent">
          ← {obraQuery.data?.nombre ?? "Regresar"}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-ink">Registrar evidencia</h1>
      </div>

      {!avanceId && (
        <Card>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label>Fecha del registro</Label>
              <Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} max={hoyISO()} />
            </div>
            <div>
              <Label>¿Qué se hizo?</Label>
              <Textarea required rows={4} placeholder="Describe el trabajo de hoy..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            {error && <p className="text-sm text-crit">{error}</p>}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : "Siguiente: agregar fotos"}
            </Button>
          </form>
        </Card>
      )}

      {avanceId && (
        <div className="space-y-3">
          <Card>
            <p className="mb-1 text-sm font-medium text-ink">Fotos (obligatorio)</p>
            <p className="mb-3 text-xs text-ink-soft">Agrega al menos una foto para poder finalizar el registro.</p>
            <EvidenceUploader entidadTipo="avance" entidadId={avanceId} />
            {!tieneFoto && <p className="mt-2 text-xs text-warn">Falta al menos una foto.</p>}
          </Card>

          <Link to={`/mis-obras/${obraId}`}>
            <Button className="w-full" disabled={!tieneFoto}>
              {tieneFoto ? "Finalizar" : "Agrega una foto para finalizar"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
