import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { esGasto, Transaccion } from "../../lib/types";
import { Button, Card, EmptyState, Input, Label, Pill } from "../../components/ui";

const TIPO_LABEL: Record<string, string> = {
  presupuesto_inicial: "Presupuesto inicial",
  ajuste_presupuesto: "Ajuste de presupuesto",
  costo_mano_obra: "Costo de mano de obra",
  costo_material: "Costo de material",
  otro_costo: "Otro costo",
  devolucion: "Devolucion",
};

export function TransaccionesTab({ obraId, puedeEditar }: { obraId: string; puedeEditar: boolean }) {
  const [editando, setEditando] = useState<Transaccion | null>(null);
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

      {query.data?.length === 0 && <EmptyState>Sin transacciones todavia.</EmptyState>}

      <div className="space-y-2">
        {query.data?.map((t) => {
          const gasto = esGasto(t.tipo);
          const monto = Math.abs(t.monto);
          return (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    {TIPO_LABEL[t.tipo] ?? t.tipo}
                    {t.tipo === "costo_mano_obra" && t.persona && (
                      <span className="font-normal text-ink-soft"> · {t.persona.nombreCompleto}</span>
                    )}
                  </p>
                  <p className={`text-lg font-semibold ${gasto ? "text-crit" : "text-ok"}`}>
                    {gasto ? "−" : "+"}${monto.toLocaleString("es-MX")}
                  </p>
                  <p className="text-xs text-ink-soft">{t.descripcion}</p>
                  {t.motivoAjuste && <p className="mt-1 text-xs text-copper">Editada — motivo: {t.motivoAjuste}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={gasto ? "crit" : "ok"}>{gasto ? "Gasto" : "Presupuesto"}</Pill>
                  {t.updatedBy && <Pill tone="warn">Editada</Pill>}
                  {puedeEditar && (
                    <Button variant="ghost" onClick={() => setEditando(t)}>
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {editando && <EditarTransaccionForm obraId={obraId} transaccion={editando} onDone={() => setEditando(null)} />}
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
