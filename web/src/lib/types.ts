export type RoleName =
  | "Administrador"
  | "Gerente de Proyecto"
  | "Supervisor"
  | "Oficial"
  | "Finanzas"
  | "Solo lectura";

export interface Usuario {
  id: string;
  email: string;
  rol: RoleName;
  tenantId: string;
  tenantNombre: string;
  personaId: string | null;
  personaNombre: string | null;
}

export interface Obra {
  id: string;
  nombre: string;
  cliente: string | null;
  ubicacion: string | null;
  descripcion?: string | null;
  observaciones?: string | null;
  estado: "planeada" | "en_ejecucion" | "pausada" | "cerrada" | "cancelada";
  responsable: string | null;
  responsableId?: string | null;
  // Omitidos por el backend para roles sin acceso financiero (Oficial, Gerente de Proyecto).
  presupuestoAutorizado?: number;
  personasAsignadas: number;
  fechaInicio: string | null;
  fechaFinEstimada: string | null;
  consumidoTotal?: number;
  porcentajeConsumido?: number;
}

export interface Persona {
  id: string;
  nombreCompleto: string;
  telefono: string | null;
  puesto: string | null;
  tipoTrabajador: string | null;
  // Omitido por el backend para roles sin acceso financiero.
  costoDiario?: number;
  activo: boolean;
}

export interface ObraPersona {
  id: string;
  obraId: string;
  personaId: string;
  rolEnObra: string | null;
  costoDiarioObra?: number | null;
  activo: boolean;
  persona: Persona;
}

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

export interface ResumenFinanciero {
  partidas: PartidaConSaldo[];
  presupuestoTotal: number;
  consumidoTotal: number;
  disponibleTotal: number;
  porcentajeConsumido: number;
}

export interface Asistencia {
  id: string;
  obraId: string;
  personaId: string;
  fecha: string;
  horaLlegada: string;
  observaciones: string | null;
  persona?: Persona;
  obra?: Obra;
  transaccion?: Transaccion | null;
}

export interface Avance {
  id: string;
  obraId: string;
  fecha: string;
  descripcion: string;
  avancePersonas: { persona: Persona }[];
  evidencias?: Evidencia[];
  incompleto?: boolean;
}

export interface Evidencia {
  id: string;
  entidadTipo: string;
  entidadId: string;
  url: string;
  tipoMime: string | null;
  createdAt: string;
}

export interface Transaccion {
  id: string;
  obraId: string;
  partidaId: string;
  tipo: string;
  monto: number;
  montoConSigno?: number;
  esGasto?: boolean;
  descripcion: string | null;
  motivoAjuste: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  partida?: PartidaConSaldo;
  persona?: Persona | null;
}

const TIPOS_GASTO = ["costo_mano_obra", "costo_material", "otro_costo"];
export function esGasto(tipo: string): boolean {
  return TIPOS_GASTO.includes(tipo);
}

export interface Material {
  id: string;
  nombre: string;
  unidad: string | null;
  categoria: string | null;
}

export interface Remision {
  id: string;
  obraId: string;
  partidaId: string;
  proveedor: string;
  folio: string | null;
  fecha: string;
  costoTotal: number;
  materiales: { id: string; material: Material; cantidad: number; costoUnitario: number; costoTotal: number }[];
}

export interface Herramienta {
  id: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  estado: "disponible" | "asignada" | "mantenimiento" | "baja";
  asignacionVigente?: HerramientaAsignacion | null;
}

export interface HerramientaAsignacion {
  id: string;
  herramientaId: string;
  obraId: string | null;
  personaId: string | null;
  custodioNombre: string | null;
  fechaAsignacion: string;
  fechaDevolucion: string | null;
  observaciones: string | null;
  herramienta?: Herramienta;
  obra?: Obra | null;
  persona?: Persona | null;
}

export interface Notificaciones {
  guardadas: { id: string; tipo: string; mensaje: string; createdAt: string }[];
  sinActividad: { obraId: string; mensaje: string }[];
  avancesIncompletos: { obraId: string; mensaje: string }[];
}
