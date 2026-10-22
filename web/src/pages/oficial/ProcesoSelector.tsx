import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../../lib/api";
import { Asistencia, Avance, Obra, ObraPersona } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { fechaCorta, fechaLarga, hoyLocal, horaLocal } from "../../lib/fechas";
import { seleccionInicial } from "../../lib/asistencias";
import { Confirmacion } from "../../components/Confirmacion";
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
  const fecha = hoyLocal();
  const llegaron = useQuery({
    queryKey: ["asistencias", obraId, fecha],
    queryFn: () => api.get<Asistencia[]>(`/obras/${obraId}/asistencias`, { params: { fecha_desde: fecha, fecha_hasta: fecha } }).then((r) => r.data),
    enabled: !!obraId,
  });
  const avances = useQuery({
    queryKey: ["avances", obraId],
    queryFn: () => api.get<Avance[]>(`/obras/${obraId}/avances`).then((r) => r.data),
    enabled: !!obraId,
  });
  const ultima = avances.data?.[0];
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
    meta: { aviso: false },
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
    <div className="space-y-4">
      <div>
        {variasObras && (
          <Link to="/mis-obras" className="inline-flex min-h-[44px] items-center text-sm text-accent">
            ← Mis obras
          </Link>
        )}
        <h1 className="text-2xl font-bold leading-snug text-ink">{query.data?.nombre ?? "Cargando…"}</h1>
        {query.data?.cliente && <p className="text-sm text-ink-soft">{query.data.cliente}</p>}
      </div>

      <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Hoy · {fechaLarga(fecha)}</p>

      {registrada ? (
        <Confirmacion
          titulo={`Llegada registrada a las ${registrada}`}
          detalle={usuario?.personaNombre}
          accion={hoy && hoy.avances === 0 ? { label: "Registrar evidencia de hoy", to: `/mis-obras/${obraId}/evidencia` } : undefined}
        />
      ) : (
        puedeLlegar &&
        hoy &&
        (hoy.miLlegada ? (
          <div className="flex items-center gap-3 rounded-xl border border-ok/40 bg-ok-soft p-4 font-semibold text-ok">
            <IconoPaloma /> Llegaste a las {hoy.miLlegada}
          </div>
        ) : (
          <button
            type="button"
            disabled={llegada.isPending}
            onClick={() => llegada.mutate()}
            className="flex min-h-[76px] w-full items-center gap-4 rounded-xl bg-accent p-4 text-left text-white active:bg-accent-ink disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20"><IconoPaloma /></span>
            <span>
              <span className="block text-lg font-bold">{llegada.isPending ? "Registrando…" : "Registrar mi llegada"}</span>
              <span className="num block text-sm opacity-90">Ahora · {horaLocal()}</span>
            </span>
          </button>
        ))
      )}
      {error && <p className="text-sm text-crit">{error}</p>}

      <Link
        to={`/mis-obras/${obraId}/evidencia`}
        className="flex min-h-[76px] items-center gap-4 rounded-xl border-2 border-graphite bg-white p-4 active:bg-[#FAFAF8]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F1F1EE]"><IconoCamara /></span>
        <span>
          <span className="block text-lg font-bold text-ink">Subir evidencia</span>
          <span className="block text-sm text-ink-soft">{hoy && hoy.avances > 0 ? "Ya hay evidencia hoy · agregar otra" : "Fotos y qué se hizo hoy"}</span>
        </span>
      </Link>

      <Link to={`/mis-obras/${obraId}/asistencia`} className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent">
        {puedeLlegar ? "Registrar a otra persona o cambiar hora →" : "Registrar asistencia →"}
      </Link>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <h2 className="px-4 pb-2 pt-3 font-semibold text-ink">Quién llegó hoy</h2>
        <div className="divide-y divide-[#EDEDEA] border-t border-[#EDEDEA]">
          {llegaron.data?.length === 0 && <p className="px-4 py-3 text-sm text-ink-soft">Nadie ha registrado su llegada todavía.</p>}
          {llegaron.data?.map((x) => (
            <p key={x.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>{x.persona?.nombreCompleto}{x.personaId === usuario?.personaId && " (tú)"}</span>
              <span className="num text-sm font-semibold text-ok">{x.horaLlegada}</span>
            </p>
          ))}
        </div>
      </section>

      <section className="space-y-1 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold text-ink">Última evidencia</h2>
        {ultima ? (
          <>
            <p className="text-sm text-ink-soft">
              {fechaCorta(ultima.fecha)} · {ultima.evidencias?.length ? `${ultima.evidencias.length} ${ultima.evidencias.length === 1 ? "foto" : "fotos"}` : "sin fotos"}
            </p>
            <p className="line-clamp-2 text-sm text-ink">{ultima.descripcion}</p>
          </>
        ) : (
          <p className="text-sm text-ink-soft">Aún no hay evidencias.</p>
        )}
      </section>
    </div>
  );
}

function IconoPaloma() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>;
}

function IconoCamara() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 text-ink" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
