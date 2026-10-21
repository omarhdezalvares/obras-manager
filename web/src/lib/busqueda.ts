function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Filtro de buscadores en cliente: sin distinguir mayusculas ni acentos.
export function coincideBusqueda(busqueda: string, campos: (string | null | undefined)[]): boolean {
  const q = normalizar(busqueda.trim());
  if (!q) return true;
  return campos.some((c) => c && normalizar(c).includes(q));
}
