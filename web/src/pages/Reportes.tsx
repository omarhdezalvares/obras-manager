import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { puedeVerFinanciero, useAuth } from "../lib/auth";
import { Obra } from "../lib/types";
import { Button, Card, Input, Label, Select } from "../components/ui";

const TIPOS_FINANCIEROS = new Set(["presupuesto-vs-real", "materiales-remision", "costos-obra", "transacciones"]);

const TODOS_LOS_TIPOS: { value: string; label: string }[] = [
  { value: "avances", label: "Evidencias por obra" },
  { value: "asistencias-obra", label: "Asistencias por obra" },
  { value: "asistencias-persona", label: "Asistencias por persona" },
  { value: "general-equipo", label: "General de equipo" },
  { value: "presupuesto-vs-real", label: "Presupuesto vs. real" },
  { value: "materiales-remision", label: "Materiales por remision" },
  { value: "herramientas", label: "Herramientas asignadas" },
  { value: "costos-obra", label: "Costos por obra" },
  { value: "transacciones", label: "Transacciones / ajustes" },
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
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipo}-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
        <p className="text-sm text-ink-soft">Genera y descarga un Excel con los filtros de abajo.</p>
      </div>

      <Card className="space-y-3">
        <div>
          <Label>Reporte</Label>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
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
      </Card>
    </div>
  );
}
