import { prisma } from "./prisma";
import { notify } from "./notify";
import { COSTO_TIPOS } from "./finance";

// Alerta de sobreconsumo (seccion 09): si la partida quedo >= 90% de su
// presupuesto tras un nuevo costo, notifica.
export async function checkSobreconsumo(tenantId: string, obraId: string, partidaId: string): Promise<void> {
  const partida = await prisma.partidaPresupuestal.findUnique({ where: { id: partidaId } });
  if (!partida) return;
  const suma = await prisma.transaccion.aggregate({
    where: { obraId, partidaId, tipo: { in: COSTO_TIPOS } },
    _sum: { monto: true },
  });
  const presupuesto = partida.presupuestoActualizado || partida.presupuestoInicial;
  if (presupuesto <= 0) return;
  const pct = ((suma._sum.monto ?? 0) / presupuesto) * 100;
  if (pct >= 100) {
    await notify({ tenantId, tipo: "sobreconsumo_100", obraId, mensaje: `La partida "${partida.nombre}" supero el 100% de su presupuesto` });
  } else if (pct >= 90) {
    await notify({ tenantId, tipo: "sobreconsumo_90", obraId, mensaje: `La partida "${partida.nombre}" alcanzo el ${pct.toFixed(0)}% de su presupuesto` });
  }
}
