import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../../lib/api";
import { Obra, ObraPersona } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { hoyLocal, horaLocal } from "../../lib/fechas";
import { seleccionInicial } from "../../lib/asistencias";
import { Confirmacion } from "../../components/Confirmacion";
import { Button, Card } from "../../components/ui";
import { useObrasHoy } from "../../lib/obrasHoy";

// Paso 1 del flujo de campo (a peticion del usuario): selecciona proyecto
// (Mis obras) -> selecciona proceso -> pasos minimos para llenar solo lo que
// necesita. Sin ningun dato financiero en pantalla.
export function ProcesoSelector() {
  const { obraId } = useParams<{ obraId: string }>();
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["obra", obraId],
    queryFn: () => api.get<Obra & { obraPersonas: ObraPersona[] }>(`/obras/${obraId}`).then((r) => r.data),
    enabled: !!obraId,
  });

  const obrasHoy = useObrasHoy();
  // Con una sola obra, "Mis obras" redirige aqui mismo: el enlace no lleva a ningun lado.
  const variasObras = (obrasHoy.data?.length ?? 0) > 1;
  const hoy = obrasHoy.data?.find((o) => o.id === obraId)?.hoy;
  // Solo quien es persona activa asignada a la obra puede registrar su propia llegada.
  const puedeLlegar = seleccionInicial(usuario?.personaId, query.data?.obraPersonas ?? []).size > 0;
  const [registrada, setRegistrada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const llegada = useMutation({
    mutationFn: async () => {
      const hora = horaLocal();
      const { data } = await api.post(`/obras/${obraId}/asistencias`, {
        fecha: hoyLocal(),
        registros: [{ personaId: usuario!.personaId!, horaLlegada: hora }],
      });
      const r = data.resultados?.[0];
      if (!r?.ok) throw new Error(r?.motivo ?? "No se pudo registrar");
      return hora;
    },
    onSuccess: (hora) => {
      setRegistrada(hora);
      qc.invalidateQueries({ queryKey: ["obras", "hoy"] });
      qc.invalidateQueries({ queryKey: ["asistencias", obraId] });
      qc.invalidateQueries({ queryKey: ["mi-historial"] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (!obraId) return null;

  return (
    <div className="space-y-5">
      <div>
        {variasObras && (
          <Link to="/mis-obras" className="text-sm text-accent">
            ← Mis obras
          </Link>
        )}
        <h1 className="mt-1 text-xl font-semibold text-ink">{query.data?.nombre ?? "Cargando…"}</h1>
        <p className="text-sm text-ink-soft">¿Qué quieres registrar hoy?</p>
      </div>

      {registrada ? (
        <Confirmacion
          titulo={`Llegada registrada a las ${registrada}`}
          detalle={usuario?.personaNombre}
          accion={hoy && hoy.avances === 0 ? { label: "Registrar evidencia de hoy", to: `/mis-obras/${obraId}/evidencia` } : undefined}
        />
      ) : (
        puedeLlegar &&
        hoy && (
          hoy.miLlegada ? (
            <div className="rounded-lg border border-ok/40 bg-ok-soft p-4 text-center font-medium text-ok">✓ Llegaste a las {hoy.miLlegada}</div>
          ) : (
            <Button className="min-h-[64px] w-full text-lg" disabled={llegada.isPending} onClick={() => llegada.mutate()}>
              {llegada.isPending ? "Registrando…" : `Registrar mi llegada (${horaLocal()})`}
            </Button>
          )
        )
      )}
      {error && <p className="text-sm text-crit">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link to={`/mis-obras/${obraId}/asistencia`}>
          <Card className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center hover:border-accent">
            <span className="text-4xl">✅</span>
            <span className="text-lg font-semibold text-ink">Asistencia</span>
            <span className="text-xs text-ink-soft">{puedeLlegar ? "Registrar a otros o cambiar hora." : "Marca quién llegó hoy. Foto opcional."}</span>
          </Card>
        </Link>
        <Link to={`/mis-obras/${obraId}/evidencia`}>
          <Card className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center hover:border-accent">
            <span className="text-4xl">📸</span>
            <span className="text-lg font-semibold text-ink">Evidencia</span>
            <span className="text-xs text-ink-soft">Describe el trabajo realizado. Foto obligatoria.</span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
