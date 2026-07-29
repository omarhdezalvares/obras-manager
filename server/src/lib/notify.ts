import { prisma } from "./prisma";

interface NotifyParams {
  tenantId: string;
  tipo: string;
  obraId?: string;
  mensaje: string;
}

// Automatizaciones de la seccion 09 (sobreconsumo, evidencia faltante, obra
// sin actividad...) se materializan como filas en `notificaciones` en vez de
// correo/push real, que requeriria infraestructura fuera del alcance de esta
// version de test.
export async function notify(params: NotifyParams): Promise<void> {
  await prisma.notificacion.create({
    data: {
      tenantId: params.tenantId,
      tipo: params.tipo,
      obraId: params.obraId,
      mensaje: params.mensaje,
    },
  });
}
