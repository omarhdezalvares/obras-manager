// Los seis roles del documento (seccion 06). ADMIN y OFICIAL son los dos
// obligatorios; los demas se agregan porque aparecen naturalmente en la
// operacion de una empresa de instalacion.
export const ROLES = {
  ADMIN: "Administrador",
  GERENTE: "Gerente de Proyecto",
  SUPERVISOR: "Supervisor",
  OFICIAL: "Oficial",
  FINANZAS: "Finanzas",
  LECTURA: "Solo lectura",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: RoleName[] = Object.values(ROLES);

// Roles que ven TODAS las obras del tenant sin necesidad de asignacion
// explicita (seccion 13: "El Administrador ve todas las obras de su tenant").
export const TENANT_WIDE_VIEW_ROLES: RoleName[] = [ROLES.ADMIN, ROLES.FINANZAS, ROLES.LECTURA];

// Roles que pueden operar (capturar) asistencias y avances (seccion 06:
// Administrador=Total, Supervisor/Oficial=Operativo, resto=Consulta/Ninguno).
export const ASISTENCIA_AVANCE_OPERATIVO: RoleName[] = [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.OFICIAL];

// Roles que pueden crear/editar presupuesto y partidas. Gerente de Proyecto
// y Oficial quedan fuera: no deben ver ni administrar nada financiero.
export const PRESUPUESTO_GESTION: RoleName[] = [ROLES.ADMIN, ROLES.FINANZAS];

// Roles que pueden CONSULTAR presupuesto/partidas (solo lectura incluida).
export const VER_PRESUPUESTO: RoleName[] = [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.FINANZAS, ROLES.LECTURA];

// Roles que pueden crear y editar transacciones manualmente (con motivo).
export const TRANSACCION_GESTION: RoleName[] = [ROLES.ADMIN, ROLES.FINANZAS];

// Roles que pueden CONSULTAR el libro de transacciones (seccion 06: Supervisor
// = "Ninguno", Gerente/Oficial excluidos por decision de negocio posterior).
export const VER_TRANSACCIONES: RoleName[] = [ROLES.ADMIN, ROLES.FINANZAS, ROLES.LECTURA];

// Roles que no deben ver ningun dato financiero/de presupuesto en ninguna
// pantalla (obras, dashboard, reportes). Usado para sanear respuestas.
export const SIN_ACCESO_FINANCIERO: RoleName[] = [ROLES.OFICIAL, ROLES.GERENTE];

// Roles que pueden registrar remisiones.
export const REMISION_GESTION: RoleName[] = [ROLES.ADMIN, ROLES.GERENTE, ROLES.SUPERVISOR, ROLES.FINANZAS];

// Roles que pueden gestionar herramientas (alta/asignacion).
export const HERRAMIENTA_GESTION: RoleName[] = [ROLES.ADMIN, ROLES.GERENTE];

// Roles que pueden gestionar obras/personas (crear/editar).
export const OBRA_PERSONA_GESTION: RoleName[] = [ROLES.ADMIN, ROLES.GERENTE];

// Roles que pueden exportar reportes a Excel (en general).
export const REPORTE_EXPORT: RoleName[] = [ROLES.ADMIN, ROLES.GERENTE, ROLES.FINANZAS];

// De esos, quienes pueden exportar/ver reportes con contenido financiero
// (presupuesto, costos, transacciones, materiales con su costo).
export const REPORTE_EXPORT_FINANCIERO: RoleName[] = [ROLES.ADMIN, ROLES.FINANZAS];

// Administracion SaaS (gestion de tenants) - solo Administrador en el piloto.
export const SAAS_ADMIN: RoleName[] = [ROLES.ADMIN];

// Modulo de Seguridad: alta, edicion, activacion/desactivacion de usuarios
// y restablecimiento de contrasena. Solo Administrador.
export const USUARIO_GESTION: RoleName[] = [ROLES.ADMIN];

// Perfil de empresa (razon social, RFC, direccion, contacto). Cualquier rol
// autenticado lo puede consultar; solo Administrador lo edita.
export const EMPRESA_GESTION: RoleName[] = [ROLES.ADMIN];
