import { Link } from "react-router-dom";

interface Alerta {
  nombre: string;
  porcentaje: number;
}

// Verde < 90, ambar >= 90, rojo >= 100; el color lo decide lo peor entre el
// total de la obra y su partida mas consumida.
export function BarraPresupuesto({ porcentaje, alerta, alertaTo }: { porcentaje: number; alerta?: Alerta | null; alertaTo?: string }) {
  const peor = Math.max(porcentaje, alerta?.porcentaje ?? 0);
  const color = peor >= 100 ? "bg-crit" : peor >= 90 ? "bg-warn" : "bg-ok";
  const texto = alerta && (
    <span className={peor >= 100 ? "text-crit" : "text-warn"}>
      ⚠ {alerta.nombre} al {alerta.porcentaje}%
    </span>
  );
  return (
    <div className="w-full min-w-[140px]">
      <p className="text-[13px] text-ink-soft">{Math.round(porcentaje)}% consumido</p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={Math.round(porcentaje)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }} />
      </div>
      {texto && (
        <p className="mt-1 text-[13px] font-medium">
          {alertaTo ? <Link to={alertaTo} className="underline-offset-2 hover:underline">{texto}</Link> : texto}
        </p>
      )}
    </div>
  );
}
