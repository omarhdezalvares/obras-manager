import { ReactNode } from "react";
import { Link } from "react-router-dom";

// Cierre claro de un registro de campo: que se guardo y que sigue.
export function Confirmacion({ titulo, detalle, accion }: { titulo: string; detalle?: ReactNode; accion?: { label: string; to: string } }) {
  return (
    <div role="status" className="rounded-lg border border-ok/40 bg-ok-soft p-5 text-center">
      <p className="text-3xl text-ok">✓</p>
      <p className="mt-1 text-lg font-semibold text-ink">{titulo}</p>
      {detalle && <div className="mt-1 text-sm text-ink">{detalle}</div>}
      {accion && (
        <Link
          to={accion.to}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-white"
        >
          {accion.label}
        </Link>
      )}
    </div>
  );
}
