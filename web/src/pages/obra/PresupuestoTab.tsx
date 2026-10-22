import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { PartidaConSaldo } from "../../lib/types";
import { Button, Card, Input, Label, Pill, Select, ListaCard, Tabla, td, th } from "../../components/ui";
import { etiquetaTipoPartida } from "../../lib/etiquetas";

function tone(pct: number): "ok" | "warn" | "crit" {
  if (pct >= 100) return "crit";
  if (pct >= 90) return "warn";
  return "ok";
}

export function PresupuestoTab({
  obraId,
  partidas,
  puedeGestionar,
}: {
  obraId: string;
  partidas: PartidaConSaldo[];
  puedeGestionar: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<PartidaConSaldo | null>(null);

  const pesos = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("es-MX")}`;
  return (
    <div className="space-y-4">
      {showForm && <NuevaPartidaForm obraId={obraId} onDone={() => setShowForm(false)} />}
      {editando && <EditarPartidaForm obraId={obraId} partida={editando} onDone={() => setEditando(null)} />}

      <ListaCard
        titulo="Partidas"
        accion={
          puedeGestionar && (
            <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancelar" : "+ Nueva partida"}
            </Button>
          )
        }
      >
        <Tabla minWidth={640}>
          <thead>
            <tr>
              <th className={th}>Partida</th>
              <th className={th}>Consumo</th>
              <th className={`${th} text-right`}>Presupuesto</th>
              <th className={`${th} text-right`}>Disponible</th>
              {puedeGestionar && <th className={th}><span className="sr-only">Acciones</span></th>}
            </tr>
          </thead>
          <tbody>
            {partidas.map((p) => {
              const pct = p.porcentajeConsumido;
              return (
                <tr key={p.id}>
                  <td className={td}>
                    <span className="num mr-1.5 text-xs text-ink-soft">{p.codigo}</span>
                    <span className="font-semibold text-ink">{p.nombre}</span>
                    <span className="block text-xs text-ink-soft">{etiquetaTipoPartida(p.tipo)}</span>
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-2" title={`${pesos(p.consumido)} consumido`}>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#ECECE8]">
                        <span className={`block h-full rounded-full ${pct >= 100 ? "bg-crit" : pct >= 90 ? "bg-warn-mark" : "bg-steel"}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                      </span>
                      <Pill tone={tone(pct)}>{pct.toFixed(0)}%</Pill>
                    </div>
                  </td>
                  <td className={`${td} num text-right text-xs`}>{pesos(p.presupuestoActualizado || p.presupuestoInicial)}</td>
                  <td className={`${td} num text-right text-xs ${p.disponible < 0 ? "font-semibold text-crit" : ""}`}>{pesos(p.disponible)}</td>
                  {puedeGestionar && (
                    <td className={`${td} text-right`}>
                      <Button variant="ghost" onClick={() => { setEditando(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                        Editar
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      </ListaCard>
    </div>
  );
}

function NuevaPartidaForm({ obraId, onDone }: { obraId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("otro");
  const [presupuestoInicial, setPresupuesto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/obras/${obraId}/partidas`, {
        codigo,
        nombre,
        tipo,
        presupuestoInicial: presupuestoInicial ? Number(presupuestoInicial) : 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra", obraId] });
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
            <Input required value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="ELEC" />
          </div>
          <div>
            <Label>Nombre</Label>
            <Input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Instalacion electrica" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="general">General</option>
              <option value="mano_obra">Mano de obra</option>
              <option value="material">Material</option>
              <option value="otro">Otro</option>
            </Select>
          </div>
          <div>
            <Label>Presupuesto inicial (MXN)</Label>
            <Input type="number" min={0} step="0.01" value={presupuestoInicial} onChange={(e) => setPresupuesto(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-crit">{error}</p>}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creando…" : "Crear partida"}
        </Button>
      </form>
    </Card>
  );
}

function EditarPartidaForm({ obraId, partida, onDone }: { obraId: string; partida: PartidaConSaldo; onDone: () => void }) {
  const qc = useQueryClient();
  const [presupuestoActualizado, setPresupuesto] = useState(String(partida.presupuestoActualizado || partida.presupuestoInicial));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/obras/${obraId}/partidas/${partida.id}`, {
        presupuestoActualizado: Number(presupuestoActualizado),
        motivo,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra", obraId] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card className="border-accent/40">
      <h2 className="mb-2 font-semibold text-ink">Editar partida · {partida.codigo}</h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <Label>Nuevo presupuesto (MXN)</Label>
          <Input type="number" min={0} step="0.01" value={presupuestoActualizado} onChange={(e) => setPresupuesto(e.target.value)} />
        </div>
        <div>
          <Label>Motivo del ajuste (obligatorio)</Label>
          <Input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. ampliacion de alcance autorizada" />
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
