import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Card, Encabezado, Select, Tabla, td, th } from "../../components/ui";

interface Fila {
  clave: string;
  registros: number;
  compraron: number;
  conversion: number;
}
interface Tendencias {
  porGiro: Fila[];
  porCanal: Fila[];
  planes: { basico: number; profesional: number; empresa: number };
}

const PERIODOS = { "30d": "Últimos 30 días", "90d": "Últimos 90 días", "12m": "Últimos 12 meses", todo: "Desde el inicio" } as const;

function TablaGrupo({ titulo, filas }: { titulo: string; filas: Fila[] }) {
  return (
    <Tabla minWidth={420}>
      <thead>
        <tr>
          <th className={th}>{titulo}</th>
          <th className={`${th} text-right`}>Registros</th>
          <th className={`${th} text-right`}>Compraron</th>
          <th className={`${th} text-right`}>Conversión</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.clave}>
            <td className={td}>{f.clave}</td>
            <td className={`${td} num text-right`}>{f.registros}</td>
            <td className={`${td} num text-right`}>{f.compraron}</td>
            <td className={`${td} num text-right`}>{f.conversion}%</td>
          </tr>
        ))}
        {!filas.length && (
          <tr>
            <td className={td} colSpan={4}>
              <span className="text-ink-soft">Sin registros en este periodo.</span>
            </td>
          </tr>
        )}
      </tbody>
    </Tabla>
  );
}

export function AdminTendencias() {
  const [periodo, setPeriodo] = useState<keyof typeof PERIODOS>("90d");
  const { data, isError } = useQuery({
    queryKey: ["admin-tendencias", periodo],
    queryFn: () => api.get<Tendencias>("/admin/tendencias", { params: { periodo } }).then((r) => r.data),
  });

  const planes = data ? ([["Profesional", data.planes.profesional], ["Básico", data.planes.basico], ["Empresa", data.planes.empresa]] as const).slice().sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="space-y-5">
      <Encabezado
        titulo="Tendencias"
        subtitulo={<Link to="/admin" className="hover:underline">← Panel Bitácora</Link>}
        accion={
          <Select aria-label="Periodo" className="sm:w-56" value={periodo} onChange={(e) => setPeriodo(e.target.value as keyof typeof PERIODOS)}>
            {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        }
      />
      {isError && <p className="text-crit">No se pudieron cargar las tendencias. Recarga la página.</p>}
      {!data && !isError && <p className="text-ink-soft">Cargando…</p>}
      {data && (
        <>
          <Card>
            <h2 className="font-semibold">Plan más comprado</h2>
            <p className="mt-1 text-sm text-ink-soft">Plan actual de las empresas que han pagado al menos una vez.</p>
            <p className="mt-3 text-lg">{planes.map(([n, c]) => `${n} ${c}`).join(" · ")}</p>
          </Card>
          <section className="space-y-2">
            <h2 className="font-semibold">Quién compra: por giro</h2>
            <TablaGrupo titulo="Giro" filas={data.porGiro} />
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold">Cómo se enteraron</h2>
            <TablaGrupo titulo="Canal" filas={data.porCanal} />
          </section>
          <p className="text-xs text-ink-soft">"Compraron" cuenta a quien pagó al menos una vez, por Stripe o con un pago manual registrado.</p>
        </>
      )}
    </div>
  );
}
