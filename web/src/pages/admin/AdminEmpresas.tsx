import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { GIROS } from "../../lib/marketing";
import { Encabezado, FilaKpis, Input, Kpi, Pill, Select, Tabla, td, th } from "../../components/ui";
import { ESTADO, METODO, NOMBRE_PLAN, fecha, pesos } from "./comun";

interface EmpresaFila {
  id: string;
  nombre: string;
  giro: string | null;
  plan: string;
  estado: string;
  vigenteHasta: string | null;
  metodoPago: string | null;
  ultimoAcceso: string | null;
  adminEmail: string | null;
}
interface Tablero {
  contadores: Record<"pagando" | "prueba" | "gracia" | "solo_lectura" | "suspendida" | "piloto", number>;
  ingresoMensualEstimado: number;
  empresas: EmpresaFila[];
}

export function AdminEmpresas() {
  const { data, isError } = useQuery({ queryKey: ["admin-empresas"], queryFn: () => api.get<Tablero>("/admin/empresas").then((r) => r.data) });
  const [estado, setEstado] = useState("");
  const [plan, setPlan] = useState("");
  const [giro, setGiro] = useState("");
  const [busca, setBusca] = useState("");

  if (isError) return <p className="text-crit">No se pudo cargar el tablero. Recarga la página.</p>;
  if (!data) return <p className="text-ink-soft">Cargando…</p>;

  const q = busca.trim().toLowerCase();
  const filas = data.empresas.filter(
    (e) =>
      (!estado || e.estado === estado) &&
      (!plan || e.plan === plan) &&
      (!giro || (giro === "sin" ? !e.giro : e.giro === giro)) &&
      (!q || e.nombre.toLowerCase().includes(q) || (e.adminEmail ?? "").toLowerCase().includes(q))
  );
  const c = data.contadores;

  return (
    <div className="space-y-5">
      <Encabezado
        titulo="Panel Bitácora"
        subtitulo="Clientes y estado de cobro"
        accion={<Link to="/admin/tendencias" className="text-sm font-semibold text-accent hover:underline">Ver tendencias</Link>}
      />
      <FilaKpis>
        <Kpi label="Pagando" valor={c.pagando} />
        <Kpi label="En prueba" valor={c.prueba} />
        <Kpi label="Pago pendiente" valor={c.gracia} tono="warn" nota={c.gracia ? "En sus 7 días de gracia" : undefined} />
        <Kpi label="Solo lectura" valor={c.solo_lectura} />
        <Kpi label="Suspendidas" valor={c.suspendida} />
        <Kpi label="Ingreso mensual" valor={pesos(data.ingresoMensualEstimado)} nota="Estimado a precio de lista, + IVA" />
      </FilaKpis>

      <div className="grid gap-3 sm:grid-cols-4">
        <Input type="search" placeholder="Buscar empresa o correo" aria-label="Buscar empresa o correo" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
        </Select>
        <Select aria-label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">Todos los planes</option>
          {Object.entries(NOMBRE_PLAN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="Giro" value={giro} onChange={(e) => setGiro(e.target.value)}>
          <option value="">Todos los giros</option>
          {GIROS.map((g) => <option key={g}>{g}</option>)}
          <option value="sin">Sin dato</option>
        </Select>
      </div>

      <Tabla minWidth={900}>
        <thead>
          <tr>
            {["Empresa", "Giro", "Plan", "Estado", "Pagado hasta", "Pago", "Último acceso"].map((h) => <th key={h} className={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((e) => (
            <tr key={e.id}>
              <td className={td}>
                <Link to={`/admin/empresas/${e.id}`} className="font-semibold text-ink hover:underline">{e.nombre}</Link>
                <span className="block text-xs text-ink-soft">{e.adminEmail ?? "Sin administrador"}</span>
              </td>
              <td className={td}>{e.giro ?? <span className="text-ink-soft">Sin dato</span>}</td>
              <td className={td}>{NOMBRE_PLAN[e.plan] ?? e.plan}</td>
              <td className={td}>{ESTADO[e.estado] && <Pill tone={ESTADO[e.estado].tono}>{ESTADO[e.estado].texto}</Pill>}</td>
              <td className={td}>{e.plan === "piloto" ? "—" : fecha(e.vigenteHasta)}</td>
              <td className={td}>{e.metodoPago ? (METODO[e.metodoPago] ?? e.metodoPago) : "—"}</td>
              <td className={td}>{fecha(e.ultimoAcceso)}</td>
            </tr>
          ))}
          {!filas.length && (
            <tr>
              <td className={td} colSpan={7}>
                <span className="text-ink-soft">Ninguna empresa coincide con los filtros.</span>
              </td>
            </tr>
          )}
        </tbody>
      </Tabla>
    </div>
  );
}
