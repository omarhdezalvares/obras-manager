function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Filtro de buscadores en cliente: sin distinguir mayusculas ni acentos.
export function coincideBusqueda(busqueda: string, campos: (string | null | undefined)[]): boolean {
  const q = normalizar(busqueda.trim());
  if (!q) return true;
  return campos.some((c) => c && normalizar(c).includes(q));
}

// Material del catalogo con el mismo nombre (sin mayusculas, acentos ni espacios extra).
export function materialPorNombre<T extends { nombre: string }>(nombre: string, materiales: T[]): T | undefined {
  const q = normalizar(nombre.trim().replace(/\s+/g, " "));
  if (!q) return undefined;
  return materiales.find((m) => normalizar(m.nombre.trim().replace(/\s+/g, " ")) === q);
}
