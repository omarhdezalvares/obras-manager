import { api, apiErrorMessage } from "./api";

// El archivo va directo del navegador al bucket con la URL firmada que da el server (no pasa por la API).
export async function subirAlBucket(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
  if (!res.ok) {
    const { message } = await res.json().catch(() => ({ message: "" }));
    throw new Error(message || `No se pudo subir el archivo (${res.status})`);
  }
}

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
    try {
      const { data } = await api.post<{ objectKey: string; uploadUrl: string }>("/evidencias/subida", {
        entidadTipo,
        entidadId,
        tipoMime: file.type,
        tamanoBytes: file.size,
      });
      await subirAlBucket(data.uploadUrl, file);
      await api.post("/evidencias", { entidadTipo, entidadId, objectKey: data.objectKey });
    } catch (err) {
      errores.push(`${file.name}: ${apiErrorMessage(err)}`);
    }
  }
  return errores;
}
