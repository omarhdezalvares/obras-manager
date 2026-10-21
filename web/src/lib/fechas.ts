// Nombres fijos en vez de toLocaleDateString: el resultado no depende del navegador.
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const dos = (n: number) => String(n).padStart(2, "0");

// "Hoy" del dispositivo; toISOString() daria la fecha UTC (manana despues de las 18:00 en Mexico).
export function hoyLocal(ahora: Date = new Date()): string {
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

export function horaLocal(ahora: Date = new Date()): string {
  return `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
}

// Acepta "YYYY-MM-DD" o un ISO completo; usa solo la parte de fecha, sin convertir zona.
function aFecha(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fechaCorta(iso: string): string {
  const f = aFecha(iso);
  return `${DIAS_CORTOS[f.getDay()]} ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
}

export function fechaLarga(iso: string): string {
  const f = aFecha(iso);
  return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}

// Para momentos guardados en UTC (createdAt, fechaAsignacion): primero al dia local.
export function fechaCortaDe(momento: string): string {
  return fechaCorta(hoyLocal(new Date(momento)));
}
