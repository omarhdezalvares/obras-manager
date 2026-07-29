import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { Persona } from "../lib/types";
import { puedeVerFinanciero, useAuth } from "../lib/auth";
import { Button, Card, EmptyState, Input, Label } from "../components/ui";

export function Personas() {
  const { usuario } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Persona | null>(null);
  const query = useQuery({ queryKey: ["personas"], queryFn: () => api.get<Persona[]>("/personas").then((r) => r.data) });
  const puedeGestionar = usuario && ["Administrador", "Gerente de Proyecto"].includes(usuario.rol);
  const verFinanciero = puedeVerFinanciero(usuario?.rol);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Personas</h1>
          <p className="text-sm text-ink-soft">Catalogo de trabajadores de campo.</p>
        </div>
        {puedeGestionar && <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "+ Nueva persona"}</Button>}
      </div>

      {showForm && <PersonaForm onDone={() => setShowForm(false)} verFinanciero={verFinanciero} />}
      {editando && <PersonaForm persona={editando} onDone={() => setEditando(null)} verFinanciero={verFinanciero} />}

      {query.data?.length === 0 && <EmptyState>Aun no hay personas registradas.</EmptyState>}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {query.data?.map((p) => (
          <Card key={p.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-ink">{p.nombreCompleto}</p>
              <p className="text-xs text-ink-soft">{p.puesto ?? "Sin puesto"} · {p.tipoTrabajador ?? "—"}</p>
              {verFinanciero && p.costoDiario != null && (
                <p className="mt-1 text-sm text-ink-soft">
                  Costo diario base: <span className="font-medium text-ink">${p.costoDiario.toLocaleString("es-MX")}</span>
                </p>
              )}
            </div>
            {puedeGestionar && (
              <Button variant="ghost" onClick={() => setEditando(p)}>
                Editar
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function PersonaForm({
  persona,
  onDone,
  verFinanciero,
}: {
  persona?: Persona;
  onDone: () => void;
  verFinanciero: boolean;
}) {
  const qc = useQueryClient();
  const [nombreCompleto, setNombre] = useState(persona?.nombreCompleto ?? "");
  const [puesto, setPuesto] = useState(persona?.puesto ?? "");
  const [tipoTrabajador, setTipo] = useState(persona?.tipoTrabajador ?? "campo");
  const [telefono, setTelefono] = useState(persona?.telefono ?? "");
  const [costoDiario, setCosto] = useState(persona?.costoDiario != null ? String(persona.costoDiario) : "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        nombreCompleto,
        puesto: puesto || undefined,
        tipoTrabajador,
        telefono: telefono || undefined,
        ...(verFinanciero ? { costoDiario: costoDiario ? Number(costoDiario) : 0 } : {}),
      };
      return persona ? api.patch(`/personas/${persona.id}`, body) : api.post("/personas", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personas"] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card>
      <h2 className="mb-2 font-semibold text-ink">{persona ? "Editar persona" : "Nueva persona"}</h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <Label>Nombre completo</Label>
          <Input required value={nombreCompleto} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label>Puesto</Label>
            <Input value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Oficial electricista" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Input value={tipoTrabajador} onChange={(e) => setTipo(e.target.value)} placeholder="campo / oficina" />
          </div>
          <div>
            <Label>Telefono</Label>
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
        </div>
        {verFinanciero && (
          <div>
            <Label>Costo diario base (MXN)</Label>
            <Input type="number" min={0} step="0.01" value={costoDiario} onChange={(e) => setCosto(e.target.value)} />
          </div>
        )}
        {error && <p className="text-sm text-crit">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : persona ? "Guardar cambios" : "Guardar persona"}
          </Button>
          {persona && (
            <Button type="button" variant="secondary" onClick={onDone}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
