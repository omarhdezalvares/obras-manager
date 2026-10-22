import { FormEvent, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../../lib/api";
import { Obra } from "../../lib/types";
import { Button, Card, Textarea } from "../../components/ui";
import { EvidenceUploader } from "../../components/EvidenceUploader";
import { Confirmacion } from "../../components/Confirmacion";
import { FechaHoy } from "../../components/FechaHoy";
import { hoyLocal } from "../../lib/fechas";
import { subirArchivos } from "../../lib/evidencias";

interface FotoLocal {
  file: File;
  url: string;
}

// Paso 2 del flujo de campo para "Evidencia": fotos y descripcion en una
// sola pantalla (foto primero, es lo natural en obra). Al menos una foto es
// obligatoria; nada se envia hasta que foto y descripcion estan completas,
// asi no se pierden las fotos elegidas si falta el texto.
export function EvidenciaWizard() {
  const { obraId } = useParams<{ obraId: string }>();
  const qc = useQueryClient();
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  const obraQuery = useQuery({
    queryKey: ["obra", obraId],
    queryFn: () => api.get<Obra>(`/obras/${obraId}`).then((r) => r.data),
    enabled: !!obraId,
  });

  const [fecha, setFecha] = useState(hoyLocal());
  const [descripcion, setDescripcion] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ avanceId: string; subidas: number; errores: string[] } | null>(null);

  // Libera las vistas previas al salir (las que se quitan se liberan en quitar()).
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  useEffect(() => () => fotosRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  function quitar(f: FotoLocal) {
    URL.revokeObjectURL(f.url);
    setFotos((prev) => prev.filter((x) => x !== f));
  }

  function agregar(files: FileList | null) {
    // Copiar ya: el FileList se vacia cuando el input se resetea (value = "").
    const nuevas = Array.from(files ?? []).map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (nuevas.length) setFotos((prev) => [...prev, ...nuevas]);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (fotos.length === 0) return setError("Agrega al menos una foto.");
    if (!descripcion.trim()) return setError("Describe qué se hizo.");
    try {
      setProgreso("Guardando…");
      const { data } = await api.post(`/obras/${obraId}/avances`, { fecha, descripcion: descripcion.trim() });
      const errores = await subirArchivos("avance", data.id, fotos.map((f) => f.file), (a, t) => setProgreso(`Subiendo foto ${a} de ${t}…`));
      setResultado({ avanceId: data.id, subidas: fotos.length - errores.length, errores });
      qc.invalidateQueries({ queryKey: ["avances", obraId] });
      qc.invalidateQueries({ queryKey: ["mi-historial"] });
      qc.invalidateQueries({ queryKey: ["obras", "hoy"] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setProgreso(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/mis-obras/${obraId}`} className="inline-flex min-h-[44px] items-center text-sm text-accent">
          ← {obraQuery.data?.nombre ?? "Regresar"}
        </Link>
        <h1 className="text-2xl font-bold text-ink">Subir evidencia</h1>
      </div>

      {resultado ? (
        <div className="space-y-3">
          <Confirmacion
            titulo="Evidencia guardada"
            detalle={
              <>
                <p>
                  {resultado.subidas} {resultado.subidas === 1 ? "foto subida" : "fotos subidas"}
                </p>
                {resultado.errores.map((e) => (
                  <p key={e} className="text-crit">
                    ✗ {e}
                  </p>
                ))}
              </>
            }
            accion={{ label: "Listo", to: `/mis-obras/${obraId}` }}
          />
          {resultado.subidas === 0 && (
            <Card>
              <p className="mb-2 text-sm font-medium text-ink">Ninguna foto se subió: vuelve a intentarlo</p>
              <EvidenceUploader entidadTipo="avance" entidadId={resultado.avanceId} />
            </Card>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-white p-4">
          <form onSubmit={guardar} className="space-y-5">
            <div>
              <p className="mb-2 font-semibold text-ink">1. Fotos <span className="font-normal text-ink-soft">(al menos una)</span></p>
              <div className="grid grid-cols-3 gap-2">
                {fotos.map((f, i) => (
                  <div key={f.url} className="relative aspect-square">
                    <img src={f.url} alt={`foto ${i + 1}`} className="h-full w-full rounded-lg border border-black/10 object-cover" />
                    <button
                      type="button"
                      aria-label="Quitar foto"
                      onClick={() => quitar(f)}
                      className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-crit shadow-sm">×</span>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => camaraRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-accent bg-accent-soft text-sm font-semibold text-accent"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                  Tomar foto
                </button>
              </div>
              <button type="button" onClick={() => galeriaRef.current?.click()} className="mt-1 min-h-[44px] text-sm font-medium text-accent">
                o elegir de la galería
              </button>
              <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { agregar(e.target.files); e.target.value = ""; }} />
              <input ref={galeriaRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { agregar(e.target.files); e.target.value = ""; }} />
            </div>
            <div>
              <label htmlFor="evid-texto" className="mb-2 block font-semibold text-ink">2. ¿Qué se hizo hoy?</label>
              <Textarea id="evid-texto" rows={4} placeholder="Describe el trabajo de hoy..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            <FechaHoy value={fecha} onChange={setFecha} />
            {error && <p className="text-sm text-crit">{error}</p>}
            {/* En celular el boton queda fijo arriba de la barra inferior: siempre a la vista. */}
            <div className="h-20 md:hidden" aria-hidden="true" />
            <div
              className="fixed inset-x-0 z-20 border-t border-line bg-white px-4 py-3 md:static md:border-0 md:p-0"
              style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
            >
              <Button type="submit" className="min-h-[52px] w-full text-base" disabled={progreso !== null}>
                {progreso ?? (fotos.length ? `Guardar evidencia · ${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}` : "Guardar evidencia")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
