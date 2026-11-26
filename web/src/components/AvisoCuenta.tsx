import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { EstadoCuenta, mensajeCuenta } from "../lib/cuenta";

export function useEstadoCuenta() {
  return useQuery({
    queryKey: ["estado-cuenta"],
    queryFn: () => api.get<EstadoCuenta>("/facturacion/estado").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

// Franja bajo el encabezado: dias de prueba, pago pendiente o solo lectura.
export function AvisoCuenta() {
  const { usuario } = useAuth();
  const { data } = useEstadoCuenta();
  const texto = data ? mensajeCuenta(data) : null;
  if (!texto) return null;
  const urgente = data!.estado === "solo_lectura" || data!.estado === "gracia";
  return (
    <div role="status" className={`border-b py-2.5 text-sm ${urgente ? "border-crit/20 bg-crit-soft text-crit" : "border-warn/20 bg-warn-soft text-warn"}`}>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-6 lg:px-8">
        <span className="font-semibold">{texto}</span>
        {usuario?.rol === "Administrador" ? (
          <Link to="/plan" className="font-semibold underline underline-offset-2">Ver plan y pago</Link>
        ) : (
          <span>Avísale al administrador de tu empresa.</span>
        )}
      </div>
    </div>
  );
}
