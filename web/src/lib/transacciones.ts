import { hoyLocal } from "./fechas";

// La fecha que importa es la del hecho (asistencia o remision), no la de
// captura; sin vinculo se usa el dia local de createdAt.
export function fechaTransaccion(t: {
  createdAt: string;
  asistencia?: { fecha: string } | null;
  remision?: { fecha: string } | null;
}): string {
  if (t.asistencia) return t.asistencia.fecha.slice(0, 10);
  if (t.remision) return t.remision.fecha.slice(0, 10);
  return hoyLocal(new Date(t.createdAt));
}

export const GRUPOS_TIPO = {
  mano_obra: "Mano de obra",
  material: "Material",
  bonos: "Bonos/comisiones",
  presupuesto: "Presupuesto",
  otros: "Otros",
} as const;

export type GrupoTipo = keyof typeof GRUPOS_TIPO;

export function grupoDeTipo(tipo: string): GrupoTipo {
  if (tipo === "costo_mano_obra") return "mano_obra";
  if (tipo === "costo_material") return "material";
  if (tipo === "bono" || tipo === "comision") return "bonos";
  if (tipo === "presupuesto_inicial" || tipo === "ajuste_presupuesto") return "presupuesto";
  return "otros";
}
