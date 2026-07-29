import { prisma } from "./prisma";

export interface PartidaConSaldo {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string | null;
  estado: string;
  presupuestoInicial: number;
  presupuestoActualizado: number;
  consumido: number;
  disponible: number;
  porcentajeConsumido: number;
}

export const COSTO_TIPOS = ["costo_mano_obra", "costo_material", "otro_costo"];

// Clasificacion usada para signo/color en transacciones y reportes: los
// gastos se muestran en negativo/rojo, las partidas de presupuesto
// (inicial, ajustes, devoluciones) en positivo/verde.
export function esGasto(tipo: string): boolean {
  return COSTO_TIPOS.includes(tipo);
}

// Seccion 05: "el saldo de una partida no es un campo que se actualiza: es
// SUM(transacciones) agrupado por partida, calculado al vuelo." Esta funcion
// es la unica fuente de verdad para presupuesto vs. real en toda la app
// (dashboard, detalle de obra y reportes reutilizan el mismo calculo).
// "Consumido" = costos (mano de obra, material, otro) netos de devoluciones;
// presupuesto_inicial/ajuste_presupuesto alimentan presupuestoActualizado,
// no el consumo.
export async function partidasConSaldo(obraId: string): Promise<PartidaConSaldo[]> {
  const partidas = await prisma.partidaPresupuestal.findMany({
    where: { obraId, deletedAt: null },
    orderBy: { codigo: "asc" },
  });

  const transacciones = await prisma.transaccion.findMany({
    where: { obraId },
    select: { partidaId: true, tipo: true, monto: true },
  });

  const consumoPorPartida = new Map<string, number>();
  for (const t of transacciones) {
    if (t.tipo === "devolucion") {
      consumoPorPartida.set(t.partidaId, (consumoPorPartida.get(t.partidaId) ?? 0) - t.monto);
    } else if (COSTO_TIPOS.includes(t.tipo)) {
      consumoPorPartida.set(t.partidaId, (consumoPorPartida.get(t.partidaId) ?? 0) + t.monto);
    }
  }

  return partidas.map((p) => {
    const consumido = consumoPorPartida.get(p.id) ?? 0;
    const presupuesto = p.presupuestoActualizado || p.presupuestoInicial;
    const disponible = presupuesto - consumido;
    return {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      tipo: p.tipo,
      estado: p.estado,
      presupuestoInicial: p.presupuestoInicial,
      presupuestoActualizado: p.presupuestoActualizado,
      consumido,
      disponible,
      porcentajeConsumido: presupuesto > 0 ? (consumido / presupuesto) * 100 : 0,
    };
  });
}

export async function resumenFinancieroObra(obraId: string) {
  const partidas = await partidasConSaldo(obraId);
  const presupuestoTotal = partidas.reduce((acc, p) => acc + (p.presupuestoActualizado || p.presupuestoInicial), 0);
  const consumidoTotal = partidas.reduce((acc, p) => acc + p.consumido, 0);
  return {
    partidas,
    presupuestoTotal,
    consumidoTotal,
    disponibleTotal: presupuestoTotal - consumidoTotal,
    porcentajeConsumido: presupuestoTotal > 0 ? (consumidoTotal / presupuestoTotal) * 100 : 0,
  };
}
