import { Link, Navigate } from "react-router-dom";
import { useObrasHoy } from "../lib/obrasHoy";
import { useAuth } from "../lib/auth";
import { fechaLarga, hoyLocal } from "../lib/fechas";
import { EmptyState } from "../components/ui";
import { Estado } from "../components/Estado";

// Pantalla "Mis obras" del oficial, pensada para celular: saludo y una
// tarjeta por obra con lo que le falta hoy. El API ya filtra sus obras.
export function MisObras() {
  const query = useObrasHoy();
  const { usuario } = useAuth();

  // Con una sola obra no hay nada que elegir: directo a la obra.
  if (query.data?.length === 1) return <Navigate to={`/mis-obras/${query.data[0].id}`} replace />;

  const h = new Date().getHours();
  const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  const nombre = usuario?.personaNombre?.split(" ")[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">{nombre ? `${saludo}, ${nombre}` : saludo}</h1>
        <p className="mt-0.5 text-ink-soft">{fechaLarga(hoyLocal())}</p>
      </div>

      {query.data?.length === 0 && <EmptyState>Todavía no estás asignado a ninguna obra. Pide al Administrador que te asigne.</EmptyState>}

      {!!query.data?.length && (
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Tus obras de hoy · {query.data.length}</p>
      )}
      <div className="space-y-3">
        {query.data?.map((o) => (
          <Link key={o.id} to={`/mis-obras/${o.id}`} className="block rounded-xl border border-line bg-white p-4 active:bg-[#FAFAF8]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold leading-snug text-ink">{o.nombre}</p>
                <p className="text-sm text-ink-soft">{[o.cliente, o.ubicacion].filter(Boolean).join(" · ")}</p>
              </div>
              <span aria-hidden="true" className="pt-1 text-2xl leading-none text-[#8A8F98]">›</span>
            </div>
            {o.hoy && (
              <div className="mt-3 space-y-2 border-t border-[#EDEDEA] pt-3">
                <Estado listo={!!o.hoy.miLlegada}>{o.hoy.miLlegada ? `Llegada registrada · ${o.hoy.miLlegada}` : "Falta registrar tu llegada"}</Estado>
                <Estado listo={o.hoy.avances > 0}>{o.hoy.avances > 0 ? "Evidencia de hoy registrada" : "Falta la evidencia de hoy"}</Estado>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
