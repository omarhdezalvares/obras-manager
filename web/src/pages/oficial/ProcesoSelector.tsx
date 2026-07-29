import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Obra } from "../../lib/types";
import { Card } from "../../components/ui";

// Paso 1 del flujo de campo (a peticion del usuario): selecciona proyecto
// (Mis obras) -> selecciona proceso -> pasos minimos para llenar solo lo que
// necesita. Sin ningun dato financiero en pantalla.
export function ProcesoSelector() {
  const { obraId } = useParams<{ obraId: string }>();
  const query = useQuery({
    queryKey: ["obra", obraId],
    queryFn: () => api.get<Obra>(`/obras/${obraId}`).then((r) => r.data),
    enabled: !!obraId,
  });

  if (!obraId) return null;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/mis-obras" className="text-sm text-accent">
          ← Mis obras
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-ink">{query.data?.nombre ?? "Cargando…"}</h1>
        <p className="text-sm text-ink-soft">¿Qué quieres registrar hoy?</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link to={`/mis-obras/${obraId}/asistencia`}>
          <Card className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center hover:border-accent">
            <span className="text-4xl">✅</span>
            <span className="text-lg font-semibold text-ink">Asistencia</span>
            <span className="text-xs text-ink-soft">Marca quién llegó hoy. Foto opcional.</span>
          </Card>
        </Link>
        <Link to={`/mis-obras/${obraId}/evidencia`}>
          <Card className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center hover:border-accent">
            <span className="text-4xl">📸</span>
            <span className="text-lg font-semibold text-ink">Evidencia</span>
            <span className="text-xs text-ink-soft">Describe el avance. Foto obligatoria.</span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
