import { FormEvent, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { puedeVerPresupuesto, puedeVerTransacciones, useAuth } from "../lib/auth";
import { HerramientaAsignacion, Obra, ObraPersona, ResumenFinanciero } from "../lib/types";
import { Button, Card, Input, Label, Pill, Textarea } from "../components/ui";
import { AsistenciasTab } from "./obra/AsistenciasTab";
import { AvancesTab } from "./obra/AvancesTab";
import { PersonasTab } from "./obra/PersonasTab";
import { PresupuestoTab } from "./obra/PresupuestoTab";
import { TransaccionesTab } from "./obra/TransaccionesTab";
import { RemisionesTab } from "./obra/RemisionesTab";
import { HerramientasTab } from "./obra/HerramientasTab";

interface ObraDetalle extends Obra {
  obraPersonas: ObraPersona[];
  financiero?: ResumenFinanciero;
  herramientaAsignaciones: HerramientaAsignacion[];
}

function pctTone(pct: number): "ok" | "warn" | "crit" {
  if (pct >= 100) return "crit";
  if (pct >= 90) return "warn";
  return "ok";
}

type TabKey = "resumen" | "personas" | "asistencias" | "avances" | "presupuesto" | "transacciones" | "remisiones" | "herramientas";

export function ObraDetail() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const [tab, setTab] = useState<TabKey>("resumen");
  const [editando, setEditando] = useState(false);

  const query = useQuery({
    queryKey: ["obra", id],
    queryFn: () => api.get<ObraDetalle>(`/obras/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  if (!id) return null;
  // El Oficial usa el flujo simplificado de campo (Mis obras), no esta vista de gestion.
  if (usuario?.rol === "Oficial") return <Navigate to={`/mis-obras/${id}`} replace />;
  if (query.isLoading) return <p className="text-sm text-ink-soft">Cargando obra…</p>;
  if (!query.data) return <p className="text-sm text-crit">No se pudo cargar la obra.</p>;

  const obra = query.data;
  const esOperativo = usuario && ["Administrador", "Supervisor", "Oficial"].includes(usuario.rol);
  const esGestion = usuario && ["Administrador", "Gerente de Proyecto"].includes(usuario.rol);
  const esFinanzas = usuario && ["Administrador", "Finanzas"].includes(usuario.rol);
  const verPresupuesto = puedeVerPresupuesto(usuario?.rol);
  const verTransacciones = puedeVerTransacciones(usuario?.rol);

  const tabs: { key: TabKey; label: string; visible: boolean }[] = [
    { key: "resumen", label: "Resumen", visible: true },
    { key: "asistencias", label: "Asistencias", visible: true },
    { key: "avances", label: "Avances", visible: true },
    { key: "personas", label: "Personas", visible: !!usuario },
    { key: "presupuesto", label: "Presupuesto", visible: verPresupuesto },
    { key: "transacciones", label: "Transacciones", visible: verTransacciones },
    { key: "remisiones", label: "Remisiones", visible: !!usuario },
    { key: "herramientas", label: "Herramientas", visible: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{obra.nombre}</h1>
          <p className="text-sm text-ink-soft">{obra.cliente} · {obra.ubicacion}</p>
        </div>
        {esGestion && (
          <Button variant="secondary" onClick={() => setEditando((v) => !v)}>
            {editando ? "Cancelar" : "Editar obra"}
          </Button>
        )}
      </div>

      {editando && <EditarObraForm obra={obra} onDone={() => setEditando(false)} />}

      {verPresupuesto && obra.financiero && (
        <Card className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs uppercase text-ink-soft">Presupuesto</p>
            <p className="font-semibold">${obra.financiero.presupuestoTotal.toLocaleString("es-MX")}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-ink-soft">Consumido</p>
            <p className="font-semibold">${obra.financiero.consumidoTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-ink-soft">Disponible</p>
            <p className="font-semibold">${obra.financiero.disponibleTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</p>
          </div>
          <Pill tone={pctTone(obra.financiero.porcentajeConsumido)}>{obra.financiero.porcentajeConsumido.toFixed(0)}% consumido</Pill>
        </Card>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-black/10 pb-px">
        {tabs
          .filter((t) => t.visible)
          .map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-t-md px-3 py-2 text-sm font-medium ${
                tab === t.key ? "border-b-2 border-accent text-accent" : "text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      <div>
        {tab === "resumen" && <ResumenTab obra={obra} esOperativo={!!esOperativo} verPresupuesto={verPresupuesto} />}
        {tab === "personas" && (
          <PersonasTab obraId={id} obraPersonas={obra.obraPersonas} puedeGestionar={!!esGestion} verFinanciero={verPresupuesto} />
        )}
        {tab === "asistencias" && (
          <AsistenciasTab obraId={id} obraPersonas={obra.obraPersonas} puedeOperar={!!esOperativo} verFinanciero={verPresupuesto} />
        )}
        {tab === "avances" && <AvancesTab obraId={id} puedeOperar={!!esOperativo} />}
        {tab === "presupuesto" && obra.financiero && (
          <PresupuestoTab obraId={id} partidas={obra.financiero.partidas} puedeGestionar={!!esFinanzas} />
        )}
        {tab === "transacciones" && <TransaccionesTab obraId={id} puedeEditar={!!esFinanzas} />}
        {tab === "remisiones" && <RemisionesTab obraId={id} partidas={obra.financiero?.partidas ?? []} />}
        {tab === "herramientas" && <HerramientasTab obraId={id} asignaciones={obra.herramientaAsignaciones ?? []} />}
      </div>
    </div>
  );
}

function ResumenTab({ obra, esOperativo, verPresupuesto }: { obra: ObraDetalle; esOperativo: boolean; verPresupuesto: boolean }) {
  return (
    <div className="space-y-3">
      {obra.descripcion && (
        <Card>
          <p className="text-xs uppercase text-ink-soft">Descripcion</p>
          <p className="mt-1 text-sm text-ink">{obra.descripcion}</p>
        </Card>
      )}
      {verPresupuesto && obra.financiero && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Partidas presupuestales</h2>
          <div className="space-y-2">
            {obra.financiero.partidas.map((p) => (
              <Card key={p.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{p.codigo} · {p.nombre}</p>
                  <p className="text-xs text-ink-soft">
                    ${p.consumido.toLocaleString("es-MX", { maximumFractionDigits: 0 })} de $
                    {(p.presupuestoActualizado || p.presupuestoInicial).toLocaleString("es-MX")}
                  </p>
                </div>
                <Pill tone={p.porcentajeConsumido >= 100 ? "crit" : p.porcentajeConsumido >= 90 ? "warn" : "ok"}>
                  {p.porcentajeConsumido.toFixed(0)}%
                </Pill>
              </Card>
            ))}
          </div>
        </div>
      )}
      {esOperativo && (
        <p className="text-xs text-ink-soft">
          Usa las pestañas "Asistencias" y "Avances" para capturar el registro diario de campo desde aqui.
        </p>
      )}
    </div>
  );
}

function EditarObraForm({ obra, onDone }: { obra: ObraDetalle; onDone: () => void }) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const verPresupuesto = puedeVerPresupuesto(usuario?.rol);

  const [nombre, setNombre] = useState(obra.nombre);
  const [cliente, setCliente] = useState(obra.cliente ?? "");
  const [ubicacion, setUbicacion] = useState(obra.ubicacion ?? "");
  const [descripcion, setDescripcion] = useState(obra.descripcion ?? "");
  const [estado, setEstado] = useState(obra.estado);
  const [presupuestoAutorizado, setPresupuesto] = useState(String(obra.presupuestoAutorizado ?? ""));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/obras/${obra.id}`, {
        nombre,
        cliente: cliente || undefined,
        ubicacion: ubicacion || undefined,
        descripcion: descripcion || undefined,
        estado,
        ...(verPresupuesto && presupuestoAutorizado ? { presupuestoAutorizado: Number(presupuestoAutorizado) } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra", obra.id] });
      qc.invalidateQueries({ queryKey: ["obras"] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card className="border-accent/40">
      <h2 className="mb-2 font-semibold text-ink">Editar obra</h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <Label>Nombre</Label>
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
        <div>
          <Label>Estado</Label>
          <select
            className="min-h-[44px] w-full rounded-md border border-black/15 bg-white px-3 text-base"
            value={estado}
            onChange={(e) => setEstado(e.target.value as ObraDetalle["estado"])}
          >
            <option value="planeada">Planeada</option>
            <option value="en_ejecucion">En ejecucion</option>
            <option value="pausada">Pausada</option>
            <option value="cerrada">Cerrada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        {verPresupuesto && (
          <div>
            <Label>Presupuesto autorizado (MXN)</Label>
            <Input type="number" min={0} step="0.01" value={presupuestoAutorizado} onChange={(e) => setPresupuesto(e.target.value)} />
          </div>
        )}
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
