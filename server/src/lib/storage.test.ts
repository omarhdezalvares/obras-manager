// Flujo real de archivos contra Supabase Storage. Solo corre con credenciales
// (local con .env); en CI se salta. Usa su propio bucket para no tocar el de la app.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import type { PrismaClient } from "@prisma/client";
import { usarSchemaDeTest } from "../testDb";

usarSchemaDeTest("test_storage");
process.env.STORAGE_BUCKET = "evidencias-test";
const conStorage = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let prisma: PrismaClient;
let server: Server;
let base = "";
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};
// PNG 1x1 valido (pdfkit lo dibuja).
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005fe02fea7d6a4b80000000049454e44ae426082",
  "hex"
);

async function llamar(quien: string, metodo: string, ruta: string, body?: unknown) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { authorization: `Bearer ${tokens[quien]}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const tipo = res.headers.get("content-type") ?? "";
  return { status: res.status, tipo, data: tipo.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}

test("keys de otro tenant o con .. no se aceptan", async () => {
  const { esKeyDelTenant } = await import("./storage");
  assert.equal(esKeyDelTenant("t1/a.png", "t1"), true);
  assert.equal(esKeyDelTenant("t2/a.png", "t1"), false);
  assert.equal(esKeyDelTenant("t1x/a.png", "t1"), false);
  assert.equal(esKeyDelTenant("t1/../t2/a.png", "t1"), false);
});

before(async () => {
  if (!conStorage) return;
  execSync("npx prisma db push --force-reset --skip-generate", { cwd: path.resolve(__dirname, "../.."), env: process.env, stdio: "ignore" });
  ({ prisma } = await import("./prisma"));
  const { app } = await import("../app");
  const { signAccessToken } = await import("./jwt");
  for (const nombre of ["A", "B"]) {
    const t = await prisma.tenant.create({ data: { nombre, slug: `storage-${nombre}` } });
    const rol = await prisma.rol.create({ data: { tenantId: t.id, nombre: "Administrador" } });
    const u = await prisma.usuario.create({ data: { tenantId: t.id, email: `${nombre}@storage.mx`, passwordHash: "x", rolId: rol.id } });
    const obra = await prisma.obra.create({ data: { tenantId: t.id, nombre: `Obra ${nombre}` } });
    const avance = await prisma.avance.create({ data: { tenantId: t.id, obraId: obra.id, fecha: new Date("2026-10-01"), descripcion: "x", registradoPor: u.id } });
    Object.assign(ids, { [`tenant${nombre}`]: t.id, [`obra${nombre}`]: obra.id, [`avance${nombre}`]: avance.id });
    tokens[nombre] = signAccessToken({ sub: u.id, tenantId: t.id, rol: "Administrador", personaId: null, email: u.email });
  }
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await prisma?.$disconnect();
});

test("subir, listar, usar en PDF/ZIP y borrar una foto", { skip: !conStorage && "sin credenciales de Supabase" }, async () => {
  const meta = { entidadTipo: "avance", entidadId: ids.avanceA };

  assert.equal((await llamar("A", "POST", "/api/evidencias/subida", { ...meta, tipoMime: "text/html", tamanoBytes: 10 })).status, 400);
  assert.equal((await llamar("A", "POST", "/api/evidencias/subida", { ...meta, tipoMime: "image/png", tamanoBytes: 16 * 1024 * 1024 })).status, 400);

  const subida = await llamar("A", "POST", "/api/evidencias/subida", { ...meta, tipoMime: "image/png", tamanoBytes: PNG.length });
  assert.equal(subida.status, 200);
  const { objectKey, uploadUrl } = subida.data as { objectKey: string; uploadUrl: string };
  assert.ok(objectKey.startsWith(`${ids.tenantA}/`));

  assert.equal((await llamar("A", "POST", "/api/evidencias", { ...meta, objectKey })).status, 400, "sin subir aun");
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "image/png" }, body: PNG });
  assert.equal(put.status, 200, await put.text());

  assert.equal((await llamar("B", "POST", "/api/evidencias", { entidadTipo: "avance", entidadId: ids.avanceB, objectKey })).status, 403, "B no reclama archivos de A");

  const creada = await llamar("A", "POST", "/api/evidencias", { ...meta, objectKey });
  assert.equal(creada.status, 201);
  const ev = creada.data as { id: string; tipoMime: string; tamanoBytes: number; url: string };
  assert.equal(ev.tipoMime, "image/png");
  assert.equal(ev.tamanoBytes, PNG.length);

  const lista = await llamar("A", "GET", `/api/evidencias?entidadTipo=avance&entidadId=${ids.avanceA}`);
  const url = (lista.data as { url: string }[])[0].url;
  const img = await fetch(url);
  assert.equal(img.status, 200, "la URL firmada abre sin token");
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), PNG);

  const pdf = await llamar("A", "GET", `/api/obras/${ids.obraA}/avances/reporte-pdf`);
  assert.equal(pdf.status, 200);
  assert.ok(pdf.tipo.includes("pdf"));
  const zip = await llamar("A", "GET", `/api/obras/${ids.obraA}/avances/fotos.zip`);
  assert.equal(zip.status, 200);
  assert.ok((zip.data as Buffer).includes(PNG.subarray(0, 8)) || (zip.data as Buffer).length > PNG.length, "el zip trae la foto");

  assert.equal((await llamar("A", "DELETE", `/api/evidencias/${ev.id}`)).status, 204);
  const { infoArchivo } = await import("./storage");
  assert.equal(await infoArchivo(objectKey), null, "el archivo se borro del bucket");
});

test("logo: solo PNG/JPG y aparece con URL firmada", { skip: !conStorage && "sin credenciales de Supabase" }, async () => {
  assert.equal((await llamar("A", "POST", "/api/empresa/logo/subida", { tipoMime: "image/webp", tamanoBytes: 10 })).status, 400);
  const { data } = await llamar("A", "POST", "/api/empresa/logo/subida", { tipoMime: "image/png", tamanoBytes: PNG.length });
  const { objectKey, uploadUrl } = data as { objectKey: string; uploadUrl: string };
  assert.equal((await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "image/png" }, body: PNG })).status, 200);
  const res = await llamar("A", "POST", "/api/empresa/logo", { objectKey });
  assert.equal(res.status, 200);
  const logoUrl = (res.data as { logoUrl: string }).logoUrl;
  assert.equal((await fetch(logoUrl)).status, 200);
  const { borrar } = await import("./storage");
  await borrar([objectKey]);
});
