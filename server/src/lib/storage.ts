import { v4 as uuid } from "uuid";
import { env } from "../env";
import { HttpError } from "../middleware/auth";

// Archivos en Supabase Storage (bucket privado) via su API REST. El navegador
// sube directo con una URL firmada (Vercel limita el body a 4.5 MB) y lee con
// URLs firmadas que caducan; el server solo valida, registra y descarga para PDF/ZIP.

export const MAX_BYTES = 15 * 1024 * 1024; // tope razonable para fotos de celular
export const EXTENSION_POR_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};
const VIGENCIA_LECTURA_S = 6 * 60 * 60;

function api(ruta: string, init: RequestInit = {}): Promise<Response> {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new HttpError(500, "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  }
  const headers = { authorization: `Bearer ${env.supabaseServiceKey}`, apikey: env.supabaseServiceKey, ...init.headers };
  return fetch(`${env.supabaseUrl}/storage/v1${ruta}`, { ...init, headers });
}

async function json<T>(res: Response, accion: string): Promise<T> {
  if (!res.ok) throw new HttpError(502, `Storage no pudo ${accion} (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

const enviarJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

// El bucket hace cumplir tipo y tamano aunque el cliente suba directo, sin pasar por el server.
let bucketListo: Promise<void> | null = null;
function asegurarBucket(): Promise<void> {
  bucketListo ??= (async () => {
    const config = { public: false, file_size_limit: MAX_BYTES, allowed_mime_types: Object.keys(EXTENSION_POR_MIME) };
    const res = await api("/bucket", enviarJson({ id: env.storageBucket, name: env.storageBucket, ...config }));
    if (res.ok) return;
    const texto = await res.text();
    if (!/already exists|Duplicate/i.test(texto)) throw new HttpError(502, `Storage no pudo crear el bucket: ${texto.slice(0, 200)}`);
  })().catch((err) => {
    bucketListo = null;
    throw err;
  });
  return bucketListo;
}

// La extension sale del tipo validado, nunca del nombre del cliente. El prefijo de tenant permite validar a quien pertenece la key.
export function nuevaKey(tenantId: string, tipoMime: string): string {
  return `${tenantId}/${uuid()}${EXTENSION_POR_MIME[tipoMime] ?? ""}`;
}

export function esKeyDelTenant(key: string, tenantId: string): boolean {
  return key.startsWith(`${tenantId}/`) && !key.includes("..");
}

export async function urlDeSubida(key: string): Promise<string> {
  await asegurarBucket();
  const { url } = await json<{ url: string }>(await api(`/object/upload/sign/${env.storageBucket}/${key}`, { method: "POST" }), "firmar la subida");
  return `${env.supabaseUrl}/storage/v1${url}`;
}

// null si el archivo no se subio (o ya no existe).
export async function infoArchivo(key: string): Promise<{ tipoMime: string | null; tamanoBytes: number } | null> {
  const res = await api(`/object/authenticated/${env.storageBucket}/${key}`, { method: "HEAD" });
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new HttpError(502, `Storage no pudo consultar el archivo (${res.status})`);
  return { tipoMime: res.headers.get("content-type"), tamanoBytes: Number(res.headers.get("content-length") ?? 0) };
}

export async function descargar(key: string): Promise<Buffer | null> {
  const res = await api(`/object/authenticated/${env.storageBucket}/${key}`);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// Descarga en tandas para no abrir cientos de conexiones a la vez en reportes grandes.
export async function descargarVarios(keys: string[], tanda = 6): Promise<Map<string, Buffer | null>> {
  const datos = new Map<string, Buffer | null>();
  for (let i = 0; i < keys.length; i += tanda) {
    const grupo = keys.slice(i, i + tanda);
    const res = await Promise.all(grupo.map(descargar));
    grupo.forEach((k, j) => datos.set(k, res[j]));
  }
  return datos;
}

// shortcut: cada llamada da URLs nuevas, asi que el navegador no las cachea entre recargas; si pesa, cachear por key unos minutos.
export async function urlsDeLectura(keys: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (keys.length === 0) return urls;
  const firmadas = await json<{ path: string; signedURL: string | null }[]>(
    await api(`/object/sign/${env.storageBucket}`, enviarJson({ expiresIn: VIGENCIA_LECTURA_S, paths: keys })),
    "firmar la lectura"
  );
  for (const f of firmadas) if (f.signedURL) urls.set(f.path, `${env.supabaseUrl}/storage/v1${f.signedURL}`);
  return urls;
}

// Se llama despues de borrar el registro: si falla, queda un archivo huerfano pero no se pierde nada.
export async function borrar(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const res = await api(`/object/${env.storageBucket}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ prefixes: keys }) });
    if (!res.ok) console.error("Storage no pudo borrar", keys, res.status, await res.text());
  } catch (err) {
    console.error("Storage no pudo borrar", keys, err);
  }
}
