import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { esGasto, ObraPersona, PartidaConSaldo, Transaccion } from "../../lib/types";
import { fechaTransaccion, grupoDeTipo, GRUPOS_TIPO, GrupoTipo } from "../../lib/transacciones";
import { fechaCorta } from "../../lib/fechas";
import { Button, Card, EmptyState, Input, Label, ListaCard, Pill, Select, Tabla, td, th } from "../../components/ui";

const TIPO_LABEL: Record<string, string> = {
  presupuesto_inicial: "Presupuesto inicial",
  ajuste_presupuesto: "Ajuste de presupuesto",
  costo_mano_obra: "Costo de mano de obra",
  costo_material: "Costo de material",
  otro_costo: "Otro costo",
  devolucion: "Devolucion",
  bono: "Bono",
  comision: "Comisión",
};

// Tipos cuyo cargo se muestra con el nombre del trabajador.
const TIPOS_CON_PERSONA = ["costo_mano_obra", "bono", "comision"];

export function TransaccionesTab({
  obraId,
  puedeEditar,
  obraPersonas,
  partidas,
}: {
  obraId: string;
  puedeEditar: boolean;
  obraPersonas: ObraPersona[];
  partidas: PartidaConSaldo[];
}) {
  const [editando, setEditando] = useState<Transaccion | null>(null);
  const [nuevoBono, setNuevoBono] = useState(false);
  const [filtro, setFiltro] = useState<GrupoTipo | "todos">("todos");
  const [verTodos, setVerTodos] = useState(false);
  const query = useQuery({
    queryKey: ["transacciones", obraId],
    queryFn: () => api.get<Transaccion[]>(`/obras/${obraId}/transacciones`).then((r) => r.data),
  });
  const signo = (t: Transaccion) => t.montoConSigno ?? (esGasto(t.tipo) ? -Math.abs(t.monto) : t.monto);
  const visibles = (query.data ?? [])
    .filter((t) => filtro === "todos" || grupoDeTipo(t.tipo) === filtro)
    .map((t) => ({ t, fecha: fechaTransaccion(t) }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const total = visibles.reduce((acc, v) => acc + signo(v.t), 0);

  // Largas listas: primeras 10 y el resto a peticion.
  const mostradas = verTodos ? visibles : visibles.slice(0, 10);

  return (
    <div className="space-y-4">
      {nuevoBono && (
        <BonoForm obraId={obraId} obraPersonas={obraPersonas} partidas={partidas} onDone={() => setNuevoBono(false)} />
      )}
      {editando && <EditarTransaccionForm obraId={obraId} transaccion={editando} onDone={() => setEditando(null)} />}

      <ListaCard
        titulo="Movimientos"
        subtitulo="Libro mayor de la obra: asistencias y remisiones generan su movimiento solas; los ajustes manuales quedan marcados con su motivo."
        accion={
          puedeEditar && (
            <Button variant="secondary" onClick={() => setNuevoBono((v) => !v)}>
              {nuevoBono ? "Cancelar" : "+ Bono / comisión"}
            </Button>
          )
        }
      >
        {query.data?.length === 0 && <div className="p-4"><EmptyState>Sin movimientos todavía.</EmptyState></div>}

        {!!query.data?.length && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
              {(["todos", ...Object.keys(GRUPOS_TIPO)] as (GrupoTipo | "todos")[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={filtro === g}
                  onClick={() => { setFiltro(g); setVerTodos(false); }}
                  className={`min-h-[40px] rounded-full border px-3 text-sm ${filtro === g ? "border-graphite bg-graphite text-white" : "border-[#D9D9D4] bg-white text-[#3A3F46]"}`}
                >
                  {g === "todos" ? "Todos" : GRUPOS_TIPO[g]}
                </button>
              ))}
            </div>
            <p className="text-sm text-ink-soft">
              {visibles.length} movimientos · total{" "}
              <span className={`num font-semibold ${total < 0 ? "text-crit" : "text-ok"}`}>
                {total < 0 ? "−" : "+"}${Math.abs(total).toLocaleString("es-MX", { maximumFractionDigits: 2 })}
              </span>
            </p>
          </div>
        )}

        {!!visibles.length && (
          <div data-movimientos>
            <Tabla minWidth={620}>
              <thead>
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>Concepto</th>
                  <th className={th}>Tipo</th>
                  <th className={`${th} text-right`}>Monto</th>
                  {puedeEditar && <th className={th}><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody>
                {mostradas.map(({ t, fecha }) => {
                  const gasto = esGasto(t.tipo);
                  const conSigno = signo(t);
                  return (
                    <tr key={t.id}>
                      <td className={`${td} num whitespace-nowrap text-xs text-ink-soft`}>{fechaCorta(fecha)}</td>
                      <td className={td}>
                        <span className="font-medium text-ink">{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                        {TIPOS_CON_PERSONA.includes(t.tipo) && t.persona && <span className="text-ink-soft"> · {t.persona.nombreCompleto}</span>}
                        {t.descripcion && <span className="block text-xs text-ink-soft">{t.descripcion}</span>}
                        {t.motivoAjuste && <span className="block text-xs text-copper">Editada — motivo: {t.motivoAjuste}</span>}
                      </td>
                      <td className={td}><Pill tone={gasto ? "crit" : "ok"}>{gasto ? "Gasto" : "Presupuesto"}</Pill></td>
                      <td className={`${td} num whitespace-nowrap text-right font-semibold ${conSigno < 0 ? "text-crit" : "text-ok"}`}>
                        {conSigno < 0 ? "−" : "+"}${Math.abs(conSigno).toLocaleString("es-MX")}
                      </td>
                      {puedeEditar && (
                        <td className={`${td} text-right`}>
                          <Button variant="ghost" onClick={() => { setEditando(t); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                            Editar
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
            {visibles.length > 10 && (
              <div className="flex justify-center border-t border-[#EDEDEA] p-3">
                <Button variant="secondary" onClick={() => setVerTodos((v) => !v)}>
                  {verTodos ? "Ver menos" : `Ver ${visibles.length - 10} ${visibles.length - 10 === 1 ? "movimiento" : "movimientos"} más`}
                </Button>
              </div>
            )}
          </div>
        )}
      </ListaCard>
    </div>
  );
}

function EditarTransaccionForm({
  obraId,
  transaccion,
  onDone,
}: {
  obraId: string;
  transaccion: Transaccion;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [monto, setMonto] = useState(String(transaccion.monto));
  const [motivoAjuste, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/obras/${obraId}/transacciones/${transaccion.id}`, { monto: Number(monto), motivoAjuste }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transacciones", obraId] });
      qc.invalidateQueries({ queryKey: ["obra", obraId] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card className="border-accent/40">
      <h2 className="mb-2 font-semibold text-ink">Editar transaccion</h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <Label>Monto (MXN)</Label>
          <Input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div>
          <Label>Motivo de ajuste (obligatorio, se exporta a Excel tal cual)</Label>
          <Input required value={motivoAjuste} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. error de captura" />
        </div>
        {error && <p className="text-sm text-crit">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : "Guardar cambio"}
          </Button>
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function BonoForm({
  obraId,
  obraPersonas,
  partidas,
  onDone,
}: {
  obraId: string;
  obraPersonas: ObraPersona[];
  partidas: PartidaConSaldo[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"bono" | "comision">("bono");
  const [personaId, setPersonaId] = useState("");
  const [partidaId, setPartidaId] = useState(
    (partidas.find((p) => p.tipo === "mano_obra") ?? partidas.find((p) => p.codigo === "GEN") ?? partidas[0])?.id ?? ""
  );
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/obras/${obraId}/transacciones`, {
        tipo,
        partidaId,
        monto: Number(monto),
        personaId: personaId || undefined,
        descripcion: descripcion || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transacciones", obraId] });
      qc.invalidateQueries({ queryKey: ["obra", obraId] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card className="border-accent/40">
      <h2 className="mb-2 font-semibold text-ink">Registrar bono o comisión</h2>
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
            <Label>Tipo</Label>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as "bono" | "comision")}>
              <option value="bono">Bono</option>
              <option value="comision">Comisión</option>
            </Select>
          </div>
          <div>
            <Label>Trabajador</Label>
            <Select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
              <option value="">— Sin trabajador —</option>
              {obraPersonas.map((op) => (
                <option key={op.personaId} value={op.personaId}>
                  {op.persona.nombreCompleto}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Partida</Label>
            <Select required value={partidaId} onChange={(e) => setPartidaId(e.target.value)}>
              {partidas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Monto (MXN)</Label>
            <Input type="number" required min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Descripción</Label>
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. bono por avance de colado" />
        </div>
        {error && <p className="text-sm text-crit">{error}</p>}
        <Button type="submit" disabled={!partidaId || mutation.isPending}>
          {mutation.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </Card>
  );
}
