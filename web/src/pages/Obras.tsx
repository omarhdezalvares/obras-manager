import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";
import { Obra } from "../lib/types";
import { puedeVerFinanciero, useAuth } from "../lib/auth";
import { Button, Card, EmptyState, Input, Label, Pill, Textarea } from "../components/ui";

function pctTone(pct: number): "ok" | "warn" | "crit" {
  if (pct >= 100) return "crit";
  if (pct >= 90) return "warn";
  return "ok";
}

const ESTADOS: Record<Obra["estado"], string> = {
  planeada: "Planeada",
  en_ejecucion: "En ejecucion",
  pausada: "Pausada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

export function Obras() {
  const { usuario } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const obrasQuery = useQuery({ queryKey: ["obras"], queryFn: () => api.get<Obra[]>("/obras").then((r) => r.data) });

  const puedeCrear = usuario && ["Administrador", "Gerente de Proyecto"].includes(usuario.rol);
  const verFinanciero = puedeVerFinanciero(usuario?.rol);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Obras</h1>
          <p className="text-sm text-ink-soft">Encabezado del proyecto: cliente, ubicacion y estado.</p>
        </div>
        {puedeCrear && (
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "+ Nueva obra"}</Button>
        )}
      </div>

      {showForm && <NuevaObraForm onDone={() => setShowForm(false)} verFinanciero={verFinanciero} />}

      {obrasQuery.isLoading && <p className="text-sm text-ink-soft">Cargando obras…</p>}
      {obrasQuery.data && obrasQuery.data.length === 0 && <EmptyState>Aun no hay obras registradas.</EmptyState>}

      <div className="space-y-2">
        {obrasQuery.data?.map((o) => (
          <Link key={o.id} to={`/obras/${o.id}`}>
            <Card className="hover:border-accent/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{o.nombre}</p>
                  <p className="text-xs text-ink-soft">{o.cliente} · {o.ubicacion}</p>
                  <p className="mt-1 text-xs text-ink-soft">Responsable: {o.responsable ?? "—"} · {o.personasAsignadas} personas</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Pill>{ESTADOS[o.estado]}</Pill>
                  {verFinanciero && o.porcentajeConsumido != null && (
                    <Pill tone={pctTone(o.porcentajeConsumido)}>{o.porcentajeConsumido.toFixed(0)}%</Pill>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NuevaObraForm({ onDone, verFinanciero }: { onDone: () => void; verFinanciero: boolean }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [cliente, setCliente] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/obras", {
        nombre,
        cliente: cliente || undefined,
        ubicacion: ubicacion || undefined,
        descripcion: descripcion || undefined,
        presupuestoAutorizado: verFinanciero && presupuesto ? Number(presupuesto) : 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obras"] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label>Nombre de la obra</Label>
          <Input required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Cliente</Label>
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </div>
          <div>
            <Label>Ubicacion</Label>
            <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Descripcion</Label>
          <Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        {verFinanciero && (
          <div>
            <Label>Presupuesto autorizado (MXN)</Label>
            <Input type="number" min={0} step="0.01" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} />
            <p className="mt-1 text-xs text-ink-soft">
              Se crea automaticamente la partida "General" y la transaccion de presupuesto inicial por este monto.
            </p>
          </div>
        )}
        {error && <p className="text-sm text-crit">{error}</p>}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creando…" : "Crear obra"}
        </Button>
      </form>
    </Card>
  );
}
