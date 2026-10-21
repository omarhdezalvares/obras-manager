import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { esGasto, ObraPersona, PartidaConSaldo, Transaccion } from "../../lib/types";
import { Button, Card, EmptyState, Input, Label, Pill, Select } from "../../components/ui";

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
  const query = useQuery({
    queryKey: ["transacciones", obraId],
    queryFn: () => api.get<Transaccion[]>(`/obras/${obraId}/transacciones`).then((r) => r.data),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">
        Libro mayor de la obra. Toda asistencia y remision genera su transaccion automaticamente; los ajustes manuales quedan
        marcados con su motivo.
      </p>

      {puedeEditar && (
        <Button variant="secondary" onClick={() => setNuevoBono((v) => !v)}>
          {nuevoBono ? "Cancelar" : "+ Bono / comisión"}
        </Button>
      )}
      {nuevoBono && (
        <BonoForm obraId={obraId} obraPersonas={obraPersonas} partidas={partidas} onDone={() => setNuevoBono(false)} />
      )}

      {editando && <EditarTransaccionForm obraId={obraId} transaccion={editando} onDone={() => setEditando(null)} />}

      {query.data?.length === 0 && <EmptyState>Sin transacciones todavia.</EmptyState>}

      <div className="space-y-2">
        {query.data?.map((t) => {
          const gasto = esGasto(t.tipo);
          const conSigno = t.montoConSigno ?? (gasto ? -Math.abs(t.monto) : t.monto);
          const resta = conSigno < 0;
          return (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    {TIPO_LABEL[t.tipo] ?? t.tipo}
                    {TIPOS_CON_PERSONA.includes(t.tipo) && t.persona && (
                      <span className="font-normal text-ink-soft"> · {t.persona.nombreCompleto}</span>
                    )}
                  </p>
                  <p className={`text-lg font-semibold ${resta ? "text-crit" : "text-ok"}`}>
                    {resta ? "−" : "+"}${Math.abs(conSigno).toLocaleString("es-MX")}
                  </p>
                  <p className="text-xs text-ink-soft">{t.descripcion}</p>
                  {t.motivoAjuste && <p className="mt-1 text-xs text-copper">Editada — motivo: {t.motivoAjuste}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={gasto ? "crit" : "ok"}>{gasto ? "Gasto" : "Presupuesto"}</Pill>
                  {t.updatedBy && <Pill tone="warn">Editada</Pill>}
                  {puedeEditar && (
                    <Button variant="ghost" onClick={() => { setEditando(t); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

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
