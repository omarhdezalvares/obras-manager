import { FormEvent, ReactNode, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../../lib/api";
import { CANALES, GIROS } from "../../lib/marketing";
import { Button, Card, Encabezado, Input, Label, Pill, Select } from "../../components/ui";
import { ESTADO, METODO, NOMBRE_PLAN, etiquetaHistorial, fecha } from "./comun";

const AVISO_STRIPE = "Esta empresa paga con Stripe; el cambio se revierte en su próximo cobro.";
const PLANES = ["basico", "profesional", "empresa", "piloto"] as const;

interface Ficha {
  id: string;
  nombre: string;
  giro: string | null;
  canal: string | null;
  canalDetalle: string | null;
  plan: string;
  activo: boolean;
  estado: string;
  vigenteHasta: string | null;
  metodoPago: string | null;
  primerPagoAt: string | null;
  tieneSuscripcion: boolean;
  createdAt: string;
  adminEmail: string | null;
  ultimoAcceso: string | null;
  uso: { obras: number; usuarios: number };
  limites: { obras: number | null; usuarios: number | null };
  historial: { accion: string; fecha: string; quien: string; cambios: { despues?: { plan?: string }; monto?: number | null; nota?: string | null } | null }[];
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{etiqueta}</dt>
      <dd className="text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

export function AdminEmpresa() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: e, isError } = useQuery({ queryKey: ["admin-empresa", id], queryFn: () => api.get<Ficha>(`/admin/empresas/${id}`).then((r) => r.data) });
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pago, setPago] = useState({ plan: "profesional", hasta: "", monto: "", nota: "" });
  const [plan, setPlan] = useState("");
  const [mkt, setMkt] = useState<{ giro: string; canal: string; canalDetalle: string } | null>(null);

  const accion = useMutation({
    mutationFn: ({ metodo, ruta, body }: { metodo: "post" | "patch"; ruta: string; body: unknown; listo: string }) =>
      api[metodo]<{ aviso?: string | null }>(`/admin/empresas/${id}/${ruta}`, body).then((r) => r.data),
    onSuccess: (d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-empresa", id] });
      qc.invalidateQueries({ queryKey: ["admin-empresas"] });
      setAviso({ ok: true, texto: d.aviso ? `${v.listo} ${d.aviso}` : v.listo });
    },
    onError: (err) => setAviso({ ok: false, texto: apiErrorMessage(err) }),
  });

  if (isError) return <p className="text-crit">No se encontró la empresa. <Link to="/admin" className="underline">Volver al panel</Link></p>;
  if (!e) return <p className="text-ink-soft">Cargando…</p>;
  const est = ESTADO[e.estado];
  const m = mkt ?? { giro: e.giro ?? "", canal: e.canal ?? "", canalDetalle: e.canalDetalle ?? "" };

  const registrarPago = (ev: FormEvent) => {
    ev.preventDefault();
    accion.mutate({
      metodo: "post",
      ruta: "pago-manual",
      body: { plan: pago.plan, hasta: pago.hasta, ...(pago.monto ? { monto: Number(pago.monto) } : {}), ...(pago.nota.trim() ? { nota: pago.nota } : {}) },
      listo: "Pago registrado.",
    });
  };

  return (
    <div className="space-y-5">
      <Encabezado titulo={e.nombre} subtitulo={<Link to="/admin" className="hover:underline">← Panel Bitácora</Link>} />

      {aviso && (
        <p role="status" className={`rounded-md px-4 py-3 text-sm ${aviso.ok ? "bg-ok-soft text-ok" : "bg-crit-soft text-crit"}`}>
          {aviso.texto}
        </p>
      )}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{NOMBRE_PLAN[e.plan] ?? e.plan}</h2>
          {est && <Pill tone={est.tono}>{est.texto}</Pill>}
          {e.tieneSuscripcion && <Pill tone="info">Suscripción en Stripe</Pill>}
        </div>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato etiqueta="Administrador">{e.adminEmail ?? "—"}</Dato>
          <Dato etiqueta="Pagado hasta">{e.plan === "piloto" ? "—" : fecha(e.vigenteHasta)}</Dato>
          <Dato etiqueta="Forma de pago">{e.metodoPago ? (METODO[e.metodoPago] ?? e.metodoPago) : "—"}</Dato>
          <Dato etiqueta="Registro">{fecha(e.createdAt)}</Dato>
          <Dato etiqueta="Primer pago">{fecha(e.primerPagoAt)}</Dato>
          <Dato etiqueta="Último acceso">{fecha(e.ultimoAcceso)}</Dato>
          <Dato etiqueta="Obras activas">{e.limites.obras === null ? `${e.uso.obras} · sin límite` : `${e.uso.obras} de ${e.limites.obras}`}</Dato>
          <Dato etiqueta="Usuarios">{e.limites.usuarios === null ? `${e.uso.usuarios} · sin límite` : `${e.uso.usuarios} de ${e.limites.usuarios}`}</Dato>
          <Dato etiqueta="Giro · Canal">{`${e.giro ?? "Sin dato"} · ${e.canal === "Otro" && e.canalDetalle ? `Otro: ${e.canalDetalle}` : (e.canal ?? "Sin dato")}`}</Dato>
        </dl>
      </Card>

      {e.tieneSuscripcion && <p className="rounded-md bg-warn-soft px-4 py-3 text-sm text-warn">{AVISO_STRIPE}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <form onSubmit={registrarPago} className="space-y-3">
            <h2 className="font-semibold">Registrar pago manual</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Plan</Label>
                <Select value={pago.plan} onChange={(ev) => setPago({ ...pago, plan: ev.target.value })}>
                  {PLANES.map((p) => <option key={p} value={p}>{NOMBRE_PLAN[p]}</option>)}
                </Select>
              </div>
              <div>
                <Label>Pagado hasta</Label>
                <Input type="date" required value={pago.hasta} onChange={(ev) => setPago({ ...pago, hasta: ev.target.value })} />
              </div>
              <div>
                <Label>Monto (opcional)</Label>
                <Input type="number" min={0} step="0.01" value={pago.monto} onChange={(ev) => setPago({ ...pago, monto: ev.target.value })} />
              </div>
              <div>
                <Label>Nota (opcional)</Label>
                <Input maxLength={300} value={pago.nota} onChange={(ev) => setPago({ ...pago, nota: ev.target.value })} placeholder="Transferencia directa 12 nov" />
              </div>
            </div>
            <Button type="submit" disabled={accion.isPending}>Registrar pago</Button>
          </form>
        </Card>

        <Card className="space-y-5">
          <div className="space-y-3">
            <h2 className="font-semibold">Cambiar plan</h2>
            <p className="text-sm text-ink-soft">Corrige el plan sin tocar la fecha de pago.</p>
            <div className="flex gap-3">
              <Select aria-label="Plan nuevo" value={plan || e.plan} onChange={(ev) => setPlan(ev.target.value)}>
                {PLANES.map((p) => <option key={p} value={p}>{NOMBRE_PLAN[p]}</option>)}
              </Select>
              <Button
                variant="secondary"
                className="shrink-0 whitespace-nowrap"
                disabled={accion.isPending || !plan || plan === e.plan}
                onClick={() => accion.mutate({ metodo: "patch", ruta: "plan", body: { plan }, listo: "Plan cambiado." })}
              >
                Cambiar plan
              </Button>
            </div>
          </div>
          <div className="space-y-3 border-t border-line pt-4">
            <h2 className="font-semibold">{e.activo ? "Suspender empresa" : "Reactivar empresa"}</h2>
            <p className="text-sm text-ink-soft">{e.activo ? "Nadie de la empresa podrá entrar hasta que la reactives." : "La empresa vuelve a entrar con el estado de cobro que tenga."}</p>
            <Button
              variant="secondary"
              disabled={accion.isPending}
              onClick={() => {
                if (e.activo && !confirm(`¿Suspender ${e.nombre}? Nadie de la empresa podrá entrar.`)) return;
                accion.mutate({ metodo: "patch", ruta: "activo", body: { activo: !e.activo }, listo: e.activo ? "Empresa suspendida." : "Empresa reactivada." });
              }}
            >
              {e.activo ? "Suspender" : "Reactivar"}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold">Giro y cómo se enteró</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select aria-label="Giro" value={m.giro} onChange={(ev) => setMkt({ ...m, giro: ev.target.value })}>
            <option value="" disabled>Sin dato</option>
            {GIROS.map((g) => <option key={g}>{g}</option>)}
          </Select>
          <Select aria-label="Cómo se enteró" value={m.canal} onChange={(ev) => setMkt({ ...m, canal: ev.target.value })}>
            <option value="" disabled>Sin dato</option>
            {CANALES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          {m.canal === "Otro" && <Input aria-label="¿Cuál?" placeholder="¿Cuál?" maxLength={120} value={m.canalDetalle} onChange={(ev) => setMkt({ ...m, canalDetalle: ev.target.value })} />}
        </div>
        <Button
          variant="secondary"
          disabled={accion.isPending || !mkt}
          onClick={() =>
            accion.mutate({
              metodo: "patch",
              ruta: "marketing",
              body: { ...(m.giro ? { giro: m.giro } : {}), ...(m.canal ? { canal: m.canal, canalDetalle: m.canalDetalle } : {}) },
              listo: "Datos guardados.",
            })
          }
        >
          Guardar
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Historial</h2>
        {!e.historial.length ? (
          <p className="text-sm text-ink-soft">Sin cambios de plan ni pagos todavía.</p>
        ) : (
          <ul className="divide-y divide-[#EDEDEA] text-sm">
            {e.historial.map((h, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{etiquetaHistorial(h)}</span>
                  {h.cambios?.despues?.plan && ` · ${NOMBRE_PLAN[h.cambios.despues.plan] ?? h.cambios.despues.plan}`}
                  {typeof h.cambios?.monto === "number" && ` · $${h.cambios.monto.toLocaleString("es-MX")}`}
                  {h.cambios?.nota && <span className="block text-ink-soft">{h.cambios.nota}</span>}
                </span>
                <span className="text-ink-soft">{`${fecha(h.fecha)} · ${h.quien === "stripe" ? "Stripe" : h.quien}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
