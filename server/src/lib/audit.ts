import { prisma } from "./prisma";

interface AuditParams {
  tenantId: string;
  usuarioId: string;
  entidadTipo: string;
  entidadId: string;
  accion: "crear" | "actualizar" | "eliminar" | "aprobar";
  cambios?: Record<string, unknown>;
}

// Bitacora inmutable (seccion 05 / 09): toda modificacion critica escribe
// aqui su diff antes/despues. Nunca se edita ni se borra un renglon.
export async function writeAuditLog(params: AuditParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      usuarioId: params.usuarioId,
      entidadTipo: params.entidadTipo,
      entidadId: params.entidadId,
      accion: params.accion,
      cambios: params.cambios ? JSON.stringify(params.cambios) : null,
    },
  });
}
