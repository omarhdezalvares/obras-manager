import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { Material, PartidaConSaldo, Remision } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { Button, Card, EmptyState, Input, Label, Select } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";

interface Linea {
  materialId: string;
  cantidad: string;
  costoUnitario: string;
}

export function RemisionesTab({ obraId, partidas }: { obraId: string; partidas: PartidaConSaldo[] }) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const puedeCrear = usuario && ["Administrador", "Gerente de Proyecto", "Supervisor", "Finanzas"].includes(usuario.rol);

  const remisionesQuery = useQuery({
    queryKey: ["remisiones", obraId],
    queryFn: () => api.get<Remision[]>(`/obras/${obraId}/remisiones`).then((r) => r.data),
  });
  const materialesQuery = useQuery({
    queryKey: ["materiales"],
    queryFn: () => api.get<Material[]>("/materiales").then((r) => r.data),
    enabled: !!puedeCrear,
  });

  const [showForm, setShowForm] = useState(false);
  const [partidaId, setPartidaId] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [folio, setFolio] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([{ materialId: "", cantidad: "", costoUnitario: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [ultimoId, setUltimoId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/obras/${obraId}/remisiones`, {
        partidaId,
        proveedor,
        folio: folio || undefined,
        fecha: new Date().toISOString().slice(0, 10),
        materiales: lineas
          .filter((l) => l.materialId && l.cantidad && l.costoUnitario)
          .map((l) => ({ materialId: l.materialId, cantidad: Number(l.cantidad), costoUnitario: Number(l.costoUnitario) })),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["remisiones", obraId] });
      qc.invalidateQueries({ queryKey: ["obra", obraId] });
      setUltimoId(res.data.id);
      setShowForm(false);
      setProveedor("");
      setFolio("");
      setLineas([{ materialId: "", cantidad: "", costoUnitario: "" }]);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      {puedeCrear && (
        <>
          <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "+ Nueva remision"}
          </Button>
          {showForm && (
            <Card>
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  setError(null);
                  mutation.mutate();
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <Label>Partida</Label>
                    <Select required value={partidaId} onChange={(e) => setPartidaId(e.target.value)}>
                      <option value="">Selecciona…</option>
                      {partidas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.codigo} · {p.nombre}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Proveedor</Label>
                    <Input required value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
                  </div>
                  <div>
                    <Label>Folio</Label>
                    <Input value={folio} onChange={(e) => setFolio(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Materiales</Label>
                  {lineas.map((l, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
                      <Select
                        value={l.materialId}
                        onChange={(e) =>
                          setLineas((prev) => prev.map((x, xi) => (xi === i ? { ...x, materialId: e.target.value } : x)))
                        }
                      >
                        <option value="">Material…</option>
                        {materialesQuery.data?.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre} ({m.unidad})
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="Cantidad"
                        value={l.cantidad}
                        onChange={(e) => setLineas((prev) => prev.map((x, xi) => (xi === i ? { ...x, cantidad: e.target.value } : x)))}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Costo unitario"
                        value={l.costoUnitario}
                        onChange={(e) =>
                          setLineas((prev) => prev.map((x, xi) => (xi === i ? { ...x, costoUnitario: e.target.value } : x)))
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setLineas((prev) => prev.filter((_, xi) => xi !== i))}
                        disabled={lineas.length === 1}
                      >
                        Quitar
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setLineas((prev) => [...prev, { materialId: "", cantidad: "", costoUnitario: "" }])}
                  >
                    + Agregar linea
                  </Button>
                </div>

                {error && <p className="text-sm text-crit">{error}</p>}
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Guardando…" : "Guardar remision"}
                </Button>
              </form>
            </Card>
          )}
          {ultimoId && (
            <Card>
              <p className="mb-2 text-xs text-ink-soft">Adjunta la foto de la remision fisica:</p>
              <EvidenceUploader entidadTipo="remision" entidadId={ultimoId} />
            </Card>
          )}
        </>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Remisiones</h2>
        {remisionesQuery.data?.length === 0 && <EmptyState>Sin remisiones registradas.</EmptyState>}
        <div className="space-y-2">
          {remisionesQuery.data?.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{r.proveedor} {r.folio && `· folio ${r.folio}`}</p>
                  <p className="text-xs text-ink-soft">{r.fecha.slice(0, 10)} · ${r.costoTotal.toLocaleString("es-MX")}</p>
                </div>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
                {r.materiales.map((m) => (
                  <li key={m.id}>
                    {m.material.nombre} · {m.cantidad} × ${m.costoUnitario} = ${m.costoTotal.toLocaleString("es-MX")}
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <EvidenceUploader entidadTipo="remision" entidadId={r.id} compact />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
