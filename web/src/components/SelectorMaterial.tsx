import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { materialPorNombre } from "../lib/busqueda";
import { Material } from "../lib/types";
import { Button, Input } from "./ui";

// Material de una linea de remision: se escribe para buscar en el catalogo y,
// si no existe, se agrega ahi mismo sin salir del formulario.
export function SelectorMaterial({
  materiales,
  value,
  onChange,
}: {
  materiales: Material[];
  value: string;
  onChange: (materialId: string) => void;
}) {
  const qc = useQueryClient();
  const listaId = useId();
  const [texto, setTexto] = useState(() => materiales.find((m) => m.id === value)?.nombre ?? "");
  const [unidad, setUnidad] = useState("");
  const [error, setError] = useState<string | null>(null);
  const encontrado = materialPorNombre(texto, materiales);

  const agregar = useMutation({
    mutationFn: () => api.post<Material>("/materiales", { nombre: texto.trim(), unidad: unidad.trim() || undefined }).then((r) => r.data),
    meta: { aviso: "Material agregado al catálogo" },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["materiales"] });
      setTexto(m.nombre);
      setUnidad("");
      onChange(m.id);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-1.5">
      <Input
        list={listaId}
        aria-label="Material"
        placeholder="Busca o escribe un material…"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setError(null);
          onChange(materialPorNombre(e.target.value, materiales)?.id ?? "");
        }}
      />
      <datalist id={listaId}>
        {materiales.map((m) => (
          <option key={m.id} value={m.nombre}>{m.unidad ?? ""}</option>
        ))}
      </datalist>
      {texto.trim() && !encontrado && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-accent/60 bg-accent-soft/40 p-2">
          <span className="text-xs text-ink-soft">No está en el catálogo.</span>
          <Input aria-label="Unidad del material nuevo" placeholder="Unidad (pza, m, caja)" value={unidad} onChange={(e) => setUnidad(e.target.value)} className="!min-h-[40px] !w-40 text-sm" />
          <Button type="button" variant="ghost" disabled={agregar.isPending} onClick={() => agregar.mutate()}>
            {agregar.isPending ? "Agregando…" : `+ Agregar «${texto.trim()}»`}
          </Button>
        </div>
      )}
      {encontrado?.unidad && <p className="text-xs text-ink-soft">Unidad: {encontrado.unidad}</p>}
      {error && <p className="text-xs text-crit">{error}</p>}
    </div>
  );
}
