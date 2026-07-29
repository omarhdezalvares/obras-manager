import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { Herramienta, Obra } from "../lib/types";
import { useAuth } from "../lib/auth";
import { Button, Card, EmptyState, Input, Label, Pill, Select } from "../components/ui";

export function Herramientas() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const puedeGestionar = usuario && ["Administrador", "Gerente de Proyecto"].includes(usuario.rol);

  const [showForm, setShowForm] = useState(false);
  const [asignando, setAsignando] = useState<Herramienta | null>(null);
  const [editando, setEditando] = useState<Herramienta | null>(null);

  const query = useQuery({
    queryKey: ["herramientas"],
    queryFn: () => api.get<Herramienta[]>("/herramientas").then((r) => r.data),
  });

  const devolver = useMutation({
    mutationFn: (h: Herramienta) =>
      api.post(`/herramientas/${h.id}/asignaciones/${h.asignacionVigente!.id}/devolver`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["herramientas"] }),
  });

  const ESTADO_TONE: Record<Herramienta["estado"], "ok" | "warn" | "crit" | "neutral"> = {
    disponible: "ok",
    asignada: "neutral",
    mantenimiento: "warn",
    baja: "crit",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Herramientas</h1>
          <p className="text-sm text-ink-soft">Activos controlados: un unico responsable vigente por herramienta.</p>
        </div>
        {puedeGestionar && <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "+ Nueva herramienta"}</Button>}
      </div>

      {showForm && <NuevaHerramientaForm onDone={() => setShowForm(false)} />}

      {query.data?.length === 0 && <EmptyState>Aun no hay herramientas registradas.</EmptyState>}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {query.data?.map((h) => (
          <Card key={h.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-ink">{h.nombre}</p>
                <p className="text-xs text-ink-soft">
                  {h.codigo} {h.marca && `· ${h.marca}`} {h.modelo && h.modelo}
                </p>
              </div>
              <Pill tone={ESTADO_TONE[h.estado]}>{h.estado}</Pill>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {h.asignacionVigente
                ? `Con: ${h.asignacionVigente.custodioNombre ?? h.asignacionVigente.persona?.nombreCompleto ?? "—"}${
                    h.asignacionVigente.obra ? ` · ${h.asignacionVigente.obra.nombre}` : ""
                  }`
                : "Sin asignar"}
            </p>
            {puedeGestionar && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setAsignando(h)}>
                  {h.asignacionVigente ? "Reasignar" : "Asignar"}
                </Button>
                {h.asignacionVigente && (
                  <Button variant="ghost" onClick={() => devolver.mutate(h)} disabled={devolver.isPending}>
                    Devolver
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setEditando(h)}>
                  Editar
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {asignando && <AsignarForm herramienta={asignando} onDone={() => setAsignando(null)} />}
      {editando && <EditarHerramientaForm herramienta={editando} onDone={() => setEditando(null)} />}
    </div>
  );
}

function NuevaHerramientaForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post("/herramientas", { codigo, nombre, marca: marca || undefined, modelo: modelo || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["herramientas"] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Codigo</Label>
            <Input required value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="HRM-005" />
          </div>
          <div>
            <Label>Nombre</Label>
            <Input required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label>Marca</Label>
            <Input value={marca} onChange={(e) => setMarca(e.target.value)} />
          </div>
          <div>
            <Label>Modelo</Label>
            <Input value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-crit">{error}</p>}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Guardando…" : "Guardar herramienta"}
        </Button>
      </form>
    </Card>
  );
}

function EditarHerramientaForm({ herramienta, onDone }: { herramienta: Herramienta; onDone: () => void }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(herramienta.nombre);
  const [marca, setMarca] = useState(herramienta.marca ?? "");
  const [modelo, setModelo] = useState(herramienta.modelo ?? "");
  const [estado, setEstado] = useState(herramienta.estado);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/herramientas/${herramienta.id}`, {
        nombre,
        marca: marca || undefined,
        modelo: modelo || undefined,
        estado,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["herramientas"] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card className="border-accent/40">
      <h2 className="mb-2 font-semibold text-ink">Editar {herramienta.codigo}</h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Nombre</Label>
            <Input required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={estado} onChange={(e) => setEstado(e.target.value as Herramienta["estado"])}>
              <option value="disponible">Disponible</option>
              <option value="asignada">Asignada</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="baja">Baja</option>
            </Select>
          </div>
          <div>
            <Label>Marca</Label>
            <Input value={marca} onChange={(e) => setMarca(e.target.value)} />
          </div>
          <div>
            <Label>Modelo</Label>
            <Input value={modelo} onChange={(e) => setModelo(e.target.value)} />
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
    </Card>
  );
}

function AsignarForm({ herramienta, onDone }: { herramienta: Herramienta; onDone: () => void }) {
  const qc = useQueryClient();
  const [obraId, setObraId] = useState("");
  const [custodioNombre, setCustodioNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  const obrasQuery = useQuery({ queryKey: ["obras"], queryFn: () => api.get<Obra[]>("/obras").then((r) => r.data) });

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/herramientas/${herramienta.id}/asignaciones`, {
        obraId: obraId || undefined,
        custodioNombre: custodioNombre || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["herramientas"] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card className="border-accent/40">
      <h2 className="mb-2 font-semibold text-ink">Asignar {herramienta.nombre}</h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <Label>Nombre del responsable</Label>
          <Input
            value={custodioNombre}
            onChange={(e) => setCustodioNombre(e.target.value)}
            placeholder="Escribe el nombre de quien se hace cargo"
          />
        </div>
        <div>
          <Label>Obra</Label>
          <Select value={obraId} onChange={(e) => setObraId(e.target.value)}>
            <option value="">— Ninguna —</option>
            {obrasQuery.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-ink-soft">Indica al menos uno. Asignar cierra automaticamente la asignacion vigente anterior.</p>
        {error && <p className="text-sm text-crit">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={(!obraId && !custodioNombre) || mutation.isPending}>
            {mutation.isPending ? "Asignando…" : "Confirmar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
