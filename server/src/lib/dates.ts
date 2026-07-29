// Construye medianoche LOCAL directamente desde los componentes "YYYY-MM-DD"
// en vez de `new Date(dateStr)` (que parsea como UTC) seguido de
// `setHours(0,0,0,0)` (que ajusta en hora local): esa combinacion desplaza
// la fecha un dia hacia atras en cualquier zona horaria con offset negativo
// respecto a UTC (ej. Mexico, UTC-6), rompiendo la regla de no-duplicidad
// de asistencias (obra, persona, fecha).
export function startOfDay(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}
