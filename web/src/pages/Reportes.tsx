import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { puedeVerFinanciero, useAuth } from "../lib/auth";
import { hoyLocal } from "../lib/fechas";
import { Obra } from "../lib/types";
import { Button, Card, Input, Label, Select } from "../components/ui";

const TIPOS_FINANCIEROS = new Set(["presupuesto-vs-real", "materiales-remision", "costos-obra", "transacciones"]);

const TODOS_LOS_TIPOS: { value: string; label: string; descripcion: string; paraQuien: string }[] = [
  {
    value: "avances",
    label: "Evidencias por obra",
    descripcion: "Lo registrado cada día: descripción del trabajo, quién estuvo y cuántas fotos tiene.",
    paraQuien: "Seguimiento de obra y respaldo para el cliente.",
  },
  {
    value: "asistencias-obra",
    label: "Asistencias por obra",
    descripcion: "Cada asistencia con fecha, persona y hora de llegada, por obra.",
    paraQuien: "Control de personal y nómina.",
  },
  {
    value: "asistencias-persona",
    label: "Asistencias por persona",
    descripcion: "Los días trabajados de cada persona en el periodo.",
    paraQuien: "Pago de nómina y control individual.",
  },
  {
    value: "general-equipo",
    label: "General de equipo",
    descripcion: "Resumen por obra y persona: días trabajados y costo acumulado (con bonos).",
    paraQuien: "Visión general del equipo.",
  },
  {
    value: "presupuesto-vs-real",
    label: "Presupuesto vs. real",
    descripcion: "Cada partida con su presupuesto, lo consumido y lo disponible.",
    paraQuien: "Control financiero de la obra.",
  },
  {
    value: "materiales-remision",
    label: "Materiales por remision",
    descripcion: "Material recibido por remisión: proveedor, folio, cantidades y costos.",
    paraQuien: "Compras y conciliación con proveedores.",
  },
  {
    value: "herramientas",
    label: "Herramientas asignadas",
    descripcion: "Quién tiene cada herramienta, en qué obra y desde cuándo.",
    paraQuien: "Control de activos.",
  },
  {
    value: "costos-obra",
    label: "Costos por obra",
    descripcion: "Mano de obra, materiales, bonos y otros costos por obra, con % del presupuesto.",
    paraQuien: "Dirección y finanzas.",
  },
  {
    value: "transacciones",
    label: "Transacciones / ajustes",
    descripcion: "Todos los movimientos de dinero, incluidos los ajustes manuales con su motivo.",
    paraQuien: "Auditoría y finanzas.",
  },
];

export function Reportes() {
  const { usuario } = useAuth();
  const verFinanciero = puedeVerFinanciero(usuario?.rol);
  // Gerente de Proyecto no debe ver reportes con contenido financiero/de presupuesto.
  const TIPOS = useMemo(() => TODOS_LOS_TIPOS.filter((t) => verFinanciero || !TIPOS_FINANCIEROS.has(t.value)), [verFinanciero]);

  const [tipo, setTipo] = useState(TIPOS[0].value);
  const [obraId, setObraId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const obrasQuery = useQuery({ queryKey: ["obras"], queryFn: () => api.get<Obra[]>("/obras").then((r) => r.data) });

  async function exportar() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post(
        `/reportes/${tipo}/exportar`,
        {
          obra_id: obraId || undefined,
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
        },
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipo}-${hoyLocal()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Reportes</h1>
        <p className="text-sm text-ink-soft">Elige un reporte para ver sus filtros y descargarlo en Excel.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {TIPOS.map((t) => {
          const elegido = t.value === tipo;
          return (
            <Card key={t.value} className={elegido ? "border-accent md:col-span-2" : ""}>
              <button type="button" aria-expanded={elegido} onClick={() => setTipo(t.value)} className="w-full text-left">
                <p className="font-semibold text-ink">{t.label}</p>
                <p className="mt-1 text-sm text-ink">{t.descripcion}</p>
                <p className="mt-1 text-[13px] text-ink-soft">Sirve para: {t.paraQuien}</p>
              </button>
              {elegido && (
                <div className="mt-3 space-y-3 border-t border-black/10 pt-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <Label>Obra (opcional)</Label>
                      <Select value={obraId} onChange={(e) => setObraId(e.target.value)}>
                        <option value="">Todas las visibles</option>
                        {obrasQuery.data?.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nombre}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Desde</Label>
                      <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                    </div>
                    <div>
                      <Label>Hasta</Label>
                      <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                    </div>
                  </div>
                  {error && <p className="text-sm text-crit">{error}</p>}
                  <Button onClick={exportar} disabled={loading}>
                    {loading ? "Generando…" : "Exportar a Excel"}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
