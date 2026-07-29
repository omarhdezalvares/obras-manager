import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { ObraPersona, Persona } from "../../lib/types";
import { Button, Card, EmptyState, Input, Label, Select } from "../../components/ui";

export function PersonasTab({
  obraId,
  obraPersonas,
  puedeGestionar,
  verFinanciero,
}: {
  obraId: string;
  obraPersonas: ObraPersona[];
  puedeGestionar: boolean;
  verFinanciero: boolean;
}) {
  const qc = useQueryClient();
  const personasQuery = useQuery({
    queryKey: ["personas"],
    queryFn: () => api.get<Persona[]>("/personas").then((r) => r.data),
    enabled: puedeGestionar,
  });

  const asignadasIds = new Set(obraPersonas.map((op) => op.personaId));
  const disponibles = (personasQuery.data ?? []).filter((p) => !asignadasIds.has(p.id));

  const [personaId, setPersonaId] = useState("");
  const [rolEnObra, setRol] = useState("");
  const [costoDiarioObra, setCosto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const asignar = useMutation({
    mutationFn: () =>
      api.post(`/obras/${obraId}/personas`, {
        personaId,
        rolEnObra: rolEnObra || undefined,
        costoDiarioObra: verFinanciero && costoDiarioObra ? Number(costoDiarioObra) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra", obraId] });
      setPersonaId("");
      setRol("");
      setCosto("");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const quitar = useMutation({
    mutationFn: (pid: string) => api.delete(`/obras/${obraId}/personas/${pid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra", obraId] }),
  });

  return (
    <div className="space-y-4">
      {puedeGestionar && (
        <Card>
          <h2 className="mb-3 font-semibold text-ink">Asignar persona a la obra</h2>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setError(null);
              asignar.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <Label>Persona</Label>
              <Select required value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                <option value="">Selecciona…</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombreCompleto}
                    {verFinanciero && p.costoDiario != null ? ` ($${p.costoDiario}/dia base)` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className={`grid grid-cols-1 gap-3 ${verFinanciero ? "md:grid-cols-2" : ""}`}>
              <div>
                <Label>Rol en la obra</Label>
                <Input value={rolEnObra} onChange={(e) => setRol(e.target.value)} placeholder="Oficial electricista" />
              </div>
              {verFinanciero && (
                <div>
                  <Label>Costo por proyecto (opcional)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={costoDiarioObra}
                    onChange={(e) => setCosto(e.target.value)}
                    placeholder="Override del costo diario base"
                  />
                </div>
              )}
            </div>
            {error && <p className="text-sm text-crit">{error}</p>}
            <Button type="submit" disabled={!personaId || asignar.isPending}>
              {asignar.isPending ? "Asignando…" : "Asignar"}
            </Button>
          </form>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Personas asignadas</h2>
        {obraPersonas.length === 0 && <EmptyState>Ninguna persona asignada todavia.</EmptyState>}
        <div className="space-y-2">
          {obraPersonas.map((op) => (
            <Card key={op.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{op.persona.nombreCompleto}</p>
                <p className="text-xs text-ink-soft">
                  {op.rolEnObra ?? "Sin rol especificado"}
                  {verFinanciero && op.persona.costoDiario != null && (
                    <>
                      {" · $"}
                      {(op.costoDiarioObra ?? op.persona.costoDiario).toLocaleString("es-MX")}/dia
                      {op.costoDiarioObra != null && <span className="text-copper"> (costo por proyecto)</span>}
                    </>
                  )}
                </p>
              </div>
              {puedeGestionar && (
                <Button variant="ghost" onClick={() => quitar.mutate(op.personaId)} disabled={quitar.isPending}>
                  Quitar
                </Button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
