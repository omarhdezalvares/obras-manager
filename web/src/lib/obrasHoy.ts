import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { hoyLocal } from "./fechas";
import { Obra } from "./types";

// Obras visibles con el estado del dia ("hoy" del dispositivo, ver spec).
export function useObrasHoy() {
  const fecha = hoyLocal();
  return useQuery({
    queryKey: ["obras", "hoy", fecha],
    queryFn: () => api.get<Obra[]>("/obras", { params: { fecha } }).then((r) => r.data),
  });
}
