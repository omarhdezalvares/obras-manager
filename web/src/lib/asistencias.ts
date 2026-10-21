// personaId -> hora de llegada de quienes ya tienen asistencia en `fecha`
// ("YYYY-MM-DD"); el server rechaza duplicados (obra, persona, fecha) y la UI
// los bloquea antes de enviar.
export function horasRegistradasEnFecha(
  asistencias: { personaId: string; fecha: string; horaLlegada: string }[] | undefined,
  fecha: string
): Map<string, string> {
  return new Map((asistencias ?? []).filter((a) => a.fecha.slice(0, 10) === fecha).map((a) => [a.personaId, a.horaLlegada]));
}

// Solo se preselecciona al usuario si es una persona activa asignada a la
// obra: si no, el contador "Guardar (1)" contaria a alguien que no aparece.
export function seleccionInicial(
  personaId: string | null | undefined,
  obraPersonas: { personaId: string; activo?: boolean }[]
): Set<string> {
  return new Set(personaId && obraPersonas.some((op) => op.personaId === personaId && op.activo !== false) ? [personaId] : []);
}
