import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../lib/api";
import { Obra } from "../lib/types";
import { puedeVerFinanciero, useAuth } from "../lib/auth";
import { coincideBusqueda } from "../lib/busqueda";
import { etiquetaEstadoObra } from "../lib/etiquetas";
import { BarraPresupuesto } from "../components/BarraPresupuesto";
import { Button, Card, EmptyState, Encabezado, Input, Label, ListaCard, Pill, Textarea } from "../components/ui";

export function Obras() {
  const { usuario } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const obrasQuery = useQuery({ queryKey: ["obras"], queryFn: () => api.get<Obra[]>("/obras").then((r) => r.data) });
  const filtradas = obrasQuery.data?.filter((o) => coincideBusqueda(busqueda, [o.nombre, o.cliente, o.ubicacion]));

  const puedeCrear = usuario && ["Administrador", "Gerente de Proyecto", "Finanzas"].includes(usuario.rol);
  const verFinanciero = puedeVerFinanciero(usuario?.rol);

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Obras"
        subtitulo="Cliente, ubicación, responsable y estado de cada obra."
        accion={puedeCrear && <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "+ Nueva obra"}</Button>}
      />

      {showForm && <NuevaObraForm onDone={() => setShowForm(false)} verFinanciero={verFinanciero} />}

      {obrasQuery.isLoading && <p className="text-sm text-ink-soft">Cargando obras…</p>}
      {obrasQuery.data && obrasQuery.data.length === 0 && <EmptyState>Aún no hay obras registradas.</EmptyState>}

      {!!obrasQuery.data?.length && (
        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, cliente o ubicación…" />
      )}
      {!!obrasQuery.data?.length && filtradas?.length === 0 && <EmptyState>Sin resultados para «{busqueda}».</EmptyState>}

      {!!filtradas?.length && (
        <ListaCard titulo={`${filtradas.length} ${filtradas.length === 1 ? "obra" : "obras"}`}>
          {filtradas.map((o) => (
            <Link key={o.id} to={`/obras/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-[#FAFAF8] sm:px-5">
              <div className="min-w-0 flex-1 basis-60">
                <p className="font-semibold text-ink">{o.nombre}</p>
                <p className="text-xs text-ink-soft">{[o.cliente, o.ubicacion].filter(Boolean).join(" · ")}</p>
                <p className="text-xs text-ink-soft">Responsable: {o.responsable ?? "—"} · {o.personasAsignadas} personas</p>
              </div>
              <Pill tone={o.estado === "en_ejecucion" ? "info" : "neutral"}>{etiquetaEstadoObra(o.estado)}</Pill>
              {verFinanciero && o.porcentajeConsumido != null && (
                <div className="w-full sm:w-44">
                  <BarraPresupuesto porcentaje={o.porcentajeConsumido} alerta={o.alertaPartida} />
                </div>
              )}
            </Link>
          ))}
        </ListaCard>
      )}
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
            <Label>Presupuesto autorizado por el cliente (MXN)</Label>
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
