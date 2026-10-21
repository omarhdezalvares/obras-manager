// Valores internos -> texto de pantalla (los nombres de la app no cambian).
const ESTADO_OBRA: Record<string, string> = {
  planeada: "Planeada",
  en_ejecucion: "En ejecución",
  pausada: "Pausada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};
const TIPO_PARTIDA: Record<string, string> = { mano_obra: "Mano de obra", material: "Material", general: "General" };
const ESTADO_HERRAMIENTA: Record<string, string> = {
  disponible: "Disponible",
  asignada: "Asignada",
  mantenimiento: "Mantenimiento",
  baja: "Baja",
};

// Valor desconocido: legible igual ("en_revision" -> "En revision").
function legible(valor: string): string {
  const t = valor.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const etiquetaEstadoObra = (estado: string) => ESTADO_OBRA[estado] ?? legible(estado);
export const etiquetaTipoPartida = (tipo: string | null) => (tipo ? TIPO_PARTIDA[tipo] ?? legible(tipo) : "Otro");
export const etiquetaEstadoHerramienta = (estado: string) => ESTADO_HERRAMIENTA[estado] ?? legible(estado);
