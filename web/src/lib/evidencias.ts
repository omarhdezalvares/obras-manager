import { api, apiErrorMessage } from "./api";

// Sube en secuencia; un archivo rechazado no detiene a los demas.
// Devuelve los errores como "nombre: motivo" (vacio si todo subio).
export async function subirArchivos(
  entidadTipo: string,
  entidadId: string,
  files: File[],
  onProgreso?: (actual: number, total: number) => void
): Promise<string[]> {
  const errores: string[] = [];
  for (const [i, file] of files.entries()) {
    onProgreso?.(i + 1, files.length);
    const form = new FormData();
    form.append("archivo", file);
    form.append("entidadTipo", entidadTipo);
    form.append("entidadId", entidadId);
    try {
      await api.post("/evidencias", form, { headers: { "Content-Type": "multipart/form-data" } });
    } catch (err) {
      errores.push(`${file.name}: ${apiErrorMessage(err)}`);
    }
  }
  return errores;
}
