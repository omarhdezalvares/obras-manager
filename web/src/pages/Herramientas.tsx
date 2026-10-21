import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { Herramienta, Obra, Persona } from "../lib/types";
import { useAuth } from "../lib/auth";
import { coincideBusqueda } from "../lib/busqueda";
import { etiquetaEstadoHerramienta } from "../lib/etiquetas";
import { Button, Card, EmptyState, Input, Label, Pill, Select } from "../components/ui";

export function Herramientas() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const puedeGestionar = usuario && ["Administrador", "Gerente de Proyecto", "Finanzas"].includes(usuario.rol);

  const [showForm, setShowForm] = useState(false);
  const [asignando, setAsignando] = useState<Herramienta | null>(null);
  const [editando, setEditando] = useState<Herramienta | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const query = useQuery({
    queryKey: ["herramientas"],
    queryFn: () => api.get<Herramienta[]>("/herramientas").then((r) => r.data),
  });

  const filtradas = query.data?.filter((h) =>
    coincideBusqueda(busqueda, [
      h.codigo,
      h.nombre,
      h.marca,
      h.asignacionVigente?.custodioNombre,
      h.asignacionVigente?.persona?.nombreCompleto,
      h.asignacionVigente?.obra?.nombre,
    ])
  );

  const devolver = useMutation({
    mutationFn: (h: Herramienta) =>
      api.post(`/herramientas/${h.id}/asignaciones/${h.asignacionVigente!.id}/devolver`),
    meta: { aviso: "Herramienta devuelta ✓" },
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

      {asignando && <AsignarForm herramienta={asignando} onDone={() => setAsignando(null)} />}
      {editando && <EditarHerramientaForm herramienta={editando} onDone={() => setEditando(null)} />}

      {query.data?.length === 0 && <EmptyState>Aun no hay herramientas registradas.</EmptyState>}

      {!!query.data?.length && (
        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por codigo, nombre, marca, responsable u obra…" />
      )}
      {!!query.data?.length && filtradas?.length === 0 && <EmptyState>Sin resultados para «{busqueda}».</EmptyState>}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {filtradas?.map((h) => (
          <Card key={h.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-ink">{h.nombre}</p>
                <p className="text-xs text-ink-soft">
                  {h.codigo} {h.marca && `· ${h.marca}`} {h.modelo && h.modelo}
                </p>
              </div>
              <Pill tone={ESTADO_TONE[h.estado]}>{etiquetaEstadoHerramienta(h.estado)}</Pill>
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
                <Button variant="secondary" onClick={() => { setAsignando(h); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  {h.asignacionVigente ? "Reasignar" : "Asignar"}
                </Button>
                {h.asignacionVigente && (
                  <Button variant="ghost" onClick={() => devolver.mutate(h)} disabled={devolver.isPending}>
                    Devolver
                  </Button>
                )}
                <Button variant="ghost" onClick={() => { setEditando(h); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  Editar
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

    </div>
  );
}

function NuevaHerramientaForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [responsable, setResponsable] = useState<Responsable>(RESPONSABLE_VACIO);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Herramienta>("/herramientas", {
        codigo,
        nombre,
        marca: marca || undefined,
        modelo: modelo || undefined,
      });
      if (tieneResponsable(responsable)) {
        try {
          await api.post(`/herramientas/${data.id}/asignaciones`, responsablePayload(responsable));
        } catch (err) {
          qc.invalidateQueries({ queryKey: ["herramientas"] });
          throw new Error(`La herramienta se creo, pero no se pudo asignar: ${apiErrorMessage(err)}. Asignala desde la lista.`);
        }
      }
    },
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
        <p className="text-xs text-ink-soft">Asignacion (opcional): a un trabajador y/o a una obra.</p>
        <ResponsableCampos value={responsable} onChange={setResponsable} />
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
  const [codigo, setCodigo] = useState(herramienta.codigo);
  const [nombre, setNombre] = useState(herramienta.nombre);
  const [marca, setMarca] = useState(herramienta.marca ?? "");
  const [modelo, setModelo] = useState(herramienta.modelo ?? "");
  const [estado, setEstado] = useState(herramienta.estado);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/herramientas/${herramienta.id}`, {
        codigo,
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
            <Label>Codigo</Label>
            <Input required value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
          </div>
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

const OTRO = "__otro";

interface Responsable {
  obraId: string;
  personaId: string; // OTRO = nombre libre en custodioNombre
  custodioNombre: string;
}

const RESPONSABLE_VACIO: Responsable = { obraId: "", personaId: "", custodioNombre: "" };

function responsablePayload(r: Responsable) {
  return {
    obraId: r.obraId || undefined,
    personaId: r.personaId && r.personaId !== OTRO ? r.personaId : undefined,
    custodioNombre: r.personaId === OTRO && r.custodioNombre.trim() ? r.custodioNombre.trim() : undefined,
  };
}

function tieneResponsable(r: Responsable): boolean {
  const p = responsablePayload(r);
  return !!(p.obraId || p.personaId || p.custodioNombre);
}

function ResponsableCampos({ value, onChange }: { value: Responsable; onChange: (r: Responsable) => void }) {
  const obrasQuery = useQuery({ queryKey: ["obras"], queryFn: () => api.get<Obra[]>("/obras").then((r) => r.data) });
  const personasQuery = useQuery({ queryKey: ["personas"], queryFn: () => api.get<Persona[]>("/personas").then((r) => r.data) });

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <Label>Trabajador</Label>
        <Select value={value.personaId} onChange={(e) => onChange({ ...value, personaId: e.target.value })}>
          <option value="">— Ninguno —</option>
          {personasQuery.data
            ?.filter((p) => p.activo)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombreCompleto}
              </option>
            ))}
          <option value={OTRO}>Otro (escribir nombre)…</option>
        </Select>
        {value.personaId === OTRO && (
          <Input
            className="mt-2"
            value={value.custodioNombre}
            onChange={(e) => onChange({ ...value, custodioNombre: e.target.value })}
            placeholder="Nombre de quien se hace cargo"
          />
        )}
      </div>
      <div>
        <Label>Obra</Label>
        <Select value={value.obraId} onChange={(e) => onChange({ ...value, obraId: e.target.value })}>
          <option value="">— Ninguna —</option>
          {obrasQuery.data?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function AsignarForm({ herramienta, onDone }: { herramienta: Herramienta; onDone: () => void }) {
  const qc = useQueryClient();
  const [responsable, setResponsable] = useState<Responsable>(RESPONSABLE_VACIO);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post(`/herramientas/${herramienta.id}/asignaciones`, responsablePayload(responsable)),
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
        <ResponsableCampos value={responsable} onChange={setResponsable} />
        <p className="text-xs text-ink-soft">Indica al menos uno. Asignar cierra automaticamente la asignacion vigente anterior.</p>
        {error && <p className="text-sm text-crit">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={!tieneResponsable(responsable) || mutation.isPending}>
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
