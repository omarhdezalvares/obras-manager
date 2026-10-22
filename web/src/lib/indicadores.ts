import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { hoyLocal } from "./fechas";
import { Indicadores } from "./types";

// Rango [desde, hasta] en dias locales; "hoy" siempre lo pone el cliente.
export function useIndicadores(desde: string, hasta: string, obraId?: string) {
  const hoy = hoyLocal();
  return useQuery({
    queryKey: ["indicadores", desde, hasta, hoy, obraId ?? ""],
    queryFn: () =>
      api.get<Indicadores>("/reportes/indicadores", { params: { desde, hasta, hoy, ...(obraId ? { obra_id: obraId } : {}) } }).then((r) => r.data),
  });
}

export const haceDias = (n: number) => hoyLocal(new Date(Date.now() - n * 864e5));
export const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
export const pesosCorto = (n: number) => (n >= 1000 ? `$${(n / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })}k` : `$${Math.round(n)}`);
