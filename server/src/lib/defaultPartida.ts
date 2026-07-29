import { prisma } from "./prisma";
import { HttpError } from "../middleware/auth";

// Resuelve la partida a la que se cargan automaticamente los costos
// generados por el sistema (asistencia -> mano de obra, remision -> material).
// Si el Administrador ya creo una partida especifica para ese tipo, se usa
// esa; si no, cae a la partida "General" (GEN) que toda obra tiene desde su
// creacion (seccion 08, flujo 1).
export async function resolveDefaultPartida(obraId: string, tipo: "mano_obra" | "material"): Promise<string> {
  const especifica = await prisma.partidaPresupuestal.findFirst({
    where: { obraId, tipo, estado: "activa", deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (especifica) return especifica.id;

  const general = await prisma.partidaPresupuestal.findFirst({
    where: { obraId, codigo: "GEN", deletedAt: null },
  });
  if (!general) {
    throw new HttpError(500, "La obra no tiene partida General; no se puede registrar el costo");
  }
  return general.id;
}
