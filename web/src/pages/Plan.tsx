import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useEstadoCuenta } from "../components/AvisoCuenta";
import { Button, Card, Encabezado, Pill } from "../components/ui";

type PlanPagado = "basico" | "profesional" | "empresa";
const PLANES: { id: PlanPagado; nombre: string; precio: string; detalle: string }[] = [
  { id: "basico", nombre: "Básico", precio: "1,290", detalle: "Hasta 3 obras activas y 10 usuarios" },
  { id: "profesional", nombre: "Profesional", precio: "2,690", detalle: "Hasta 10 obras activas y 30 usuarios" },
  { id: "empresa", nombre: "Empresa", precio: "5,490", detalle: "Obras y usuarios ilimitados" },
];
const NOMBRE_PLAN: Record<string, string> = { trial: "Prueba gratis", piloto: "Piloto", basico: "Básico", profesional: "Profesional", empresa: "Empresa" };
const ESTADO: Record<string, { texto: string; tono: "ok" | "warn" | "crit" | "info" }> = {
  prueba: { texto: "En prueba", tono: "info" },
  activa: { texto: "Al corriente", tono: "ok" },
  gracia: { texto: "Pago pendiente", tono: "warn" },
  solo_lectura: { texto: "Solo lectura", tono: "crit" },
  suspendida: { texto: "Suspendida", tono: "crit" },
};

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

function Uso({ etiqueta, usado, limite }: { etiqueta: string; usado: number; limite: number | null }) {
  const pct = limite ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{etiqueta}</span>
        <span className="text-ink-soft">{limite === null ? `${usado} · sin límite` : `${usado} de ${limite}`}</span>
      </div>
      {limite !== null && (
        <div className="mt-1.5 h-2 rounded-full bg-[#EDEDEA]">
          <div className={`h-2 rounded-full ${pct >= 100 ? "bg-crit" : pct >= 80 ? "bg-warn" : "bg-ok"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export function Plan() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "Administrador";
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { data: e, isError } = useEstadoCuenta();
  const [plan, setPlan] = useState<PlanPagado>("profesional");
  const [metodo, setMetodo] = useState<"tarjeta" | "transferencia">("tarjeta");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(
    params.get("pago") === "ok" ? { ok: true, texto: "Recibimos tu pago; tu plan se actualiza en unos segundos." } : null
  );

  const ir = (url: string | null) => {
    if (url) window.location.assign(url);
  };
  const fallo = (err: unknown) => setAviso({ ok: false, texto: apiErrorMessage(err) });

  const contratar = useMutation({
    mutationFn: () => api.post<{ url?: string; facturaUrl?: string | null }>(`/facturacion/${metodo === "tarjeta" ? "checkout" : "transferencia"}`, { plan }).then((r) => r.data),
    onSuccess: (d) => {
      if (d.url) return ir(d.url);
      qc.invalidateQueries({ queryKey: ["estado-cuenta"] });
      setAviso({ ok: true, texto: "Listo. Te enviamos por correo la factura con los datos para transferir." });
      ir(d.facturaUrl ?? null);
    },
    onError: fallo,
  });
  const portal = useMutation({
    mutationFn: () => api.post<{ url: string }>("/facturacion/portal").then((r) => r.data),
    onSuccess: (d) => ir(d.url),
    onError: fallo,
  });
  const cambiar = useMutation({
    mutationFn: () => api.post<{ aplica: string }>("/facturacion/cambiar-plan", { plan }).then((r) => r.data),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["estado-cuenta"] });
      setAviso({
        ok: true,
        texto: d.aplica === "al_pagar" ? "Te enviamos la factura por la diferencia; el plan cambia al pagarla." : "El cambio aplica desde tu siguiente factura.",
      });
    },
    onError: fallo,
  });

  if (isError) return <p className="text-crit">No se pudo cargar tu plan. Recarga la página.</p>;
  if (!e) return <p className="text-ink-soft">Cargando…</p>;
  const est = ESTADO[e.estado];

  return (
    <div className="space-y-5">
      <Encabezado titulo="Plan y pago" subtitulo="Precios mensuales en pesos mexicanos, más IVA." />

      {aviso && (
        <p role="status" className={`rounded-md px-4 py-3 text-sm ${aviso.ok ? "bg-ok-soft text-ok" : "bg-crit-soft text-crit"}`}>
          {aviso.texto}
        </p>
      )}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{NOMBRE_PLAN[e.plan] ?? e.plan}</h2>
          {est && <Pill tone={est.tono}>{est.texto}</Pill>}
        </div>
        {e.vigenteHasta && e.plan !== "piloto" && (
          <p className="text-sm text-ink-soft">
            {e.estado === "prueba" ? "Tu prueba termina el " : "Pagado hasta el "}
            <span className="font-semibold text-ink">{fecha(e.vigenteHasta)}</span>
            {e.metodoPago && ` · ${e.metodoPago === "tarjeta" ? "Tarjeta" : "Transferencia SPEI"}`}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Uso etiqueta="Obras activas" usado={e.uso.obras} limite={e.limites.obras} />
          <Uso etiqueta="Usuarios" usado={e.uso.usuarios} limite={e.limites.usuarios} />
        </div>
      </Card>

      {e.plan === "piloto" ? null : !e.cobroConfigurado ? (
        <Card>
          <p className="text-sm text-ink-soft">Cobro no configurado.</p>
        </Card>
      ) : !esAdmin ? (
        <Card>
          <p className="text-sm text-ink-soft">Solo el administrador de la empresa puede contratar o cambiar el plan.</p>
        </Card>
      ) : (
        <Card className="space-y-4">
          <h2 className="font-semibold">{e.tieneSuscripcion ? "Cambiar de plan" : "Contratar"}</h2>
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="sr-only">Plan</legend>
            {PLANES.map((p) => (
              <label key={p.id} className={`cursor-pointer rounded-lg border p-4 ${plan === p.id ? "border-accent ring-2 ring-accent-soft" : "border-line"}`}>
                <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="sr-only" />
                <span className="block font-semibold">{p.nombre}</span>
                <span className="mt-1 block text-2xl font-semibold">${p.precio}</span>
                <span className="block text-xs text-ink-soft">/ mes + IVA</span>
                <span className="mt-2 block text-sm text-ink-soft">{p.detalle}</span>
              </label>
            ))}
          </fieldset>

          {!e.tieneSuscripcion && (
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="mb-2 font-medium">Forma de pago</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="metodo" checked={metodo === "tarjeta"} onChange={() => setMetodo("tarjeta")} /> Tarjeta (cobro automático cada mes)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="metodo" checked={metodo === "transferencia"} onChange={() => setMetodo("transferencia")} /> Transferencia SPEI (factura mensual por correo)
              </label>
            </fieldset>
          )}

          <div className="flex flex-wrap gap-3">
            {!e.tieneSuscripcion ? (
              <Button onClick={() => contratar.mutate()} disabled={contratar.isPending}>
                {contratar.isPending ? "Abriendo…" : "Contratar"}
              </Button>
            ) : (
              <>
                {e.metodoPago === "transferencia" && (
                  <Button onClick={() => cambiar.mutate()} disabled={cambiar.isPending}>Cambiar plan</Button>
                )}
                <Button variant={e.metodoPago === "transferencia" ? "secondary" : "primary"} onClick={() => portal.mutate()} disabled={portal.isPending}>
                  {e.metodoPago === "transferencia" ? "Ver facturas o cancelar" : "Administrar pago"}
                </Button>
              </>
            )}
          </div>
          {e.estado === "prueba" && !e.tieneSuscripcion && (
            <p className="text-sm text-ink-soft">Si contratas ahora no pierdes días: el primer cobro es al terminar tu prueba.</p>
          )}
        </Card>
      )}
    </div>
  );
}
