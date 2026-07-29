import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { Evidencia } from "../lib/types";

interface Props {
  entidadTipo: "asistencia" | "avance" | "remision" | "herramienta";
  entidadId: string;
  compact?: boolean;
}

// "Boton que abre la camara directo (no el selector de galeria primero)"
// (seccion 11): capture="environment" en un input file logra eso en moviles
// sin necesitar una libreria de camara dedicada.
export function EvidenceUploader({ entidadTipo, entidadId, compact }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const key = ["evidencias", entidadTipo, entidadId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<Evidencia[]>("/evidencias", { params: { entidadTipo, entidadId } }).then((r) => r.data),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("archivo", file);
      form.append("entidadTipo", entidadTipo);
      form.append("entidadId", entidadId);
      return api.post("/evidencias", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (err) => alert(apiErrorMessage(err)),
  });

  return (
    <div className={compact ? "" : "space-y-2"}>
      <div className="flex flex-wrap gap-2">
        {query.data?.map((ev) => (
          <a key={ev.id} href={ev.url} target="_blank" rel="noreferrer">
            {ev.tipoMime?.startsWith("image/") ? (
              <img src={ev.url} alt="evidencia" className="h-16 w-16 rounded-md border border-black/10 object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-md border border-black/10 bg-slate-50 text-xs text-ink-soft">
                Archivo
              </span>
            )}
          </a>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-md border border-dashed border-black/20 text-ink-soft hover:border-accent hover:text-accent"
        >
          <span className="text-lg">📷</span>
          <span className="text-[10px]">{upload.isPending ? "Subiendo…" : "Agregar"}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
