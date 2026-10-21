import { FormEvent, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { puedeVerPresupuesto, puedeVerTransacciones, useAuth } from "../lib/auth";
import { Asistencia, Avance, HerramientaAsignacion, Obra, ObraPersona, ResumenFinanciero } from "../lib/types";
import { fechaCorta, fechaLarga, hoyLocal } from "../lib/fechas";
import { Button, Card, Input, Label, Pill, Textarea } from "../components/ui";
import { AsistenciasTab } from "./obra/AsistenciasTab";
import { BarraPresupuesto } from "../components/BarraPresupuesto";
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

type TabKey = "hoy" | "bitacora" | "equipo" | "dinero";

// Enlaces viejos (?tab=asistencias, ?tab=presupuesto…) siguen llevando a la pestana que ahora los contiene.
const TAB_DE: Record<string, TabKey> = {
  hoy: "hoy",
  resumen: "hoy",
  asistencias: "hoy",
  bitacora: "bitacora",
  avances: "bitacora",
  equipo: "equipo",
  personas: "equipo",
  herramientas: "equipo",
  dinero: "dinero",
  presupuesto: "dinero",
  transacciones: "dinero",
  remisiones: "dinero",
};

export function ObraDetail() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  // La pestana vive en la URL: un enlace ?tab= dentro de la misma obra tambien la cambia.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabKey = TAB_DE[searchParams.get("tab") ?? ""] ?? "hoy";
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
  const esOperativo = usuario && ["Administrador", "Supervisor", "Oficial", "Finanzas"].includes(usuario.rol);
  const esGestion = usuario && ["Administrador", "Gerente de Proyecto", "Finanzas"].includes(usuario.rol);
  const esFinanzas = usuario && ["Administrador", "Finanzas"].includes(usuario.rol);
  const verPresupuesto = puedeVerPresupuesto(usuario?.rol);
  const verTransacciones = puedeVerTransacciones(usuario?.rol);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "hoy", label: "Hoy" },
    { key: "bitacora", label: "Bitácora" },
    { key: "equipo", label: "Equipo" },
    // Remisiones las ven todos los roles; presupuesto y transacciones solo con acceso financiero.
    { key: "dinero", label: verPresupuesto || verTransacciones ? "Dinero" : "Remisiones" },
  ];
  const irA = (key: TabKey) => setSearchParams({ tab: key }, { replace: true });

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
          <div className="min-w-[220px] flex-1">
            <BarraPresupuesto
              porcentaje={obra.financiero.porcentajeConsumido}
              alerta={obra.financiero.alertaPartida}
              alertaTo={`/obras/${obra.id}?tab=dinero`}
            />
          </div>
        </Card>
      )}

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-black/10 pb-px">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => irA(t.key)}
            className={`min-h-[44px] shrink-0 rounded-t-md px-4 py-2 text-sm font-medium ${
              tab === t.key ? "border-b-2 border-accent text-accent" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "hoy" && <HoyTab obra={obra} esOperativo={!!esOperativo} verPresupuesto={verPresupuesto} />}
        {tab === "bitacora" && (
          <div className="space-y-6">
            <AvancesTab
              obraId={id}
              obraNombre={obra.nombre}
              puedeOperar={!!esOperativo}
              esAdmin={["Administrador", "Finanzas"].includes(usuario?.rol ?? "")}
              registrarAlAbrir={searchParams.get("registrar") === "1"}
            />
            <AsistenciasTab
              obraId={id}
              obraPersonas={obra.obraPersonas}
              puedeOperar={!!esOperativo}
              puedeEditar={!!esGestion}
              verFinanciero={verPresupuesto}
              vista="historial"
            />
          </div>
        )}
        {tab === "equipo" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PersonasTab obraId={id} obraPersonas={obra.obraPersonas} puedeGestionar={!!esGestion} verFinanciero={verPresupuesto} />
            <HerramientasTab obraId={id} asignaciones={obra.herramientaAsignaciones ?? []} />
          </div>
        )}
        {tab === "dinero" && (
          <div className="space-y-6">
            {verPresupuesto && obra.financiero && (
              <PresupuestoTab obraId={id} partidas={obra.financiero.partidas} puedeGestionar={!!esFinanzas} />
            )}
            {verTransacciones && (
              <TransaccionesTab
                obraId={id}
                puedeEditar={!!esFinanzas}
                obraPersonas={obra.obraPersonas}
                partidas={obra.financiero?.partidas ?? []}
              />
            )}
            <RemisionesTab obraId={id} partidas={obra.financiero?.partidas ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}

// "Hoy": capturar la asistencia y la evidencia del dia, y ver lo ultimo registrado.
function HoyTab({ obra, esOperativo, verPresupuesto }: { obra: ObraDetalle; esOperativo: boolean; verPresupuesto: boolean }) {
  const hoy = hoyLocal();
  const asistenciasHoy = useQuery({
    queryKey: ["asistencias", obra.id, hoy],
    queryFn: () =>
      api.get<Asistencia[]>(`/obras/${obra.id}/asistencias`, { params: { fecha_desde: hoy, fecha_hasta: hoy } }).then((r) => r.data),
    enabled: !esOperativo,
  });
  const avances = useQuery({
    queryKey: ["avances", obra.id],
    queryFn: () => api.get<Avance[]>(`/obras/${obra.id}/avances`).then((r) => r.data),
  });
  const ultima = avances.data?.[0];
  const hayEvidenciaHoy = (avances.data ?? []).some((a) => a.fecha.slice(0, 10) === hoy);
  const llegaron = asistenciasHoy.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {esOperativo ? (
        <AsistenciasTab
          obraId={obra.id}
          obraPersonas={obra.obraPersonas}
          puedeOperar
          puedeEditar={false}
          verFinanciero={verPresupuesto}
          vista="registro"
        />
      ) : (
        <Card>
          <h2 className="font-semibold text-ink">Asistencia de hoy · {fechaLarga(hoy)}</h2>
          {llegaron.length === 0 ? (
            <p className="mt-1 text-sm text-warn">Nadie ha registrado asistencia hoy.</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm text-ink">
              {llegaron.map((a) => (
                <li key={a.id}>
                  ✓ {a.persona?.nombreCompleto} <span className="text-ink-soft">· {a.horaLlegada}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <div className="space-y-3">
        <Card>
          <h2 className="font-semibold text-ink">Evidencia de hoy</h2>
          {hayEvidenciaHoy ? (
            <p className="mt-1 text-sm text-ink">✓ Ya hay evidencia registrada hoy.</p>
          ) : (
            <p className="mt-1 text-sm text-warn">Falta la evidencia del día.</p>
          )}
          {esOperativo && (
            <Link
              to={`/obras/${obra.id}?tab=bitacora&registrar=1`}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-md bg-accent px-4 text-sm font-semibold text-white"
            >
              + Registrar evidencia
            </Link>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold text-ink">Última evidencia</h2>
          {ultima ? (
            <>
              <p className="mt-1 text-sm font-medium text-ink">
                {fechaCorta(ultima.fecha)} · {ultima.evidencias?.length ?? 0} {ultima.evidencias?.length === 1 ? "foto" : "fotos"}
              </p>
              <p className="line-clamp-2 text-sm text-ink-soft">{ultima.descripcion}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">Aún no hay evidencias.</p>
          )}
        </Card>
        {obra.descripcion && (
          <Card>
            <h2 className="font-semibold text-ink">Descripción</h2>
            <p className="mt-1 text-sm text-ink">{obra.descripcion}</p>
          </Card>
        )}
      </div>
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
            <Label>Presupuesto autorizado por el cliente (MXN)</Label>
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
