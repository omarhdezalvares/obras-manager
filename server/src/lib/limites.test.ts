import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { usarSchemaDeTest } from "../testDb";

usarSchemaDeTest("test_limites");

let server: Server;
let base = "";
let token = "";
let tenantId = "";
let rolId = "";
let prisma: typeof import("./prisma").prisma;

before(async () => {
  execSync("npx prisma db push --force-reset --skip-generate", { cwd: path.resolve(__dirname, "../.."), env: process.env, stdio: "ignore" });
  ({ prisma } = await import("./prisma"));
  const { crearEmpresa } = await import("./empresa");
  const { signAccessToken } = await import("./jwt");
  const u = await crearEmpresa({ empresa: "Limites SA", email: "admin@limites.test", passwordHash: "x" });
  tenantId = u.tenantId;
  rolId = u.rolId;
  await prisma.tenant.update({ where: { id: tenantId }, data: { plan: "basico", vigenteHasta: new Date(Date.now() + 30 * 86_400_000) } });
  token = signAccessToken({ sub: u.id, tenantId, rol: "Administrador", personaId: null, email: u.email });
  const { app } = await import("../app");
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await prisma.$disconnect();
});

const pedir = (metodo: string, ruta: string, body?: unknown) =>
  fetch(`${base}${ruta}`, { method: metodo, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

const obra = (nombre: string, estado: string) => prisma.obra.create({ data: { tenantId, nombre, estado } });

test("obras activas: planeada, en ejecucion y pausada cuentan; cerrada no", async () => {
  await obra("A", "planeada");
  await obra("B", "en_ejecucion");
  const c = await obra("C", "pausada");
  const r = await pedir("POST", "/api/obras", { nombre: "D" });
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /3 obras activas/);
  await prisma.obra.update({ where: { id: c.id }, data: { estado: "cerrada" } });
  assert.equal((await pedir("POST", "/api/obras", { nombre: "D" })).status, 201);
});

test("reactivar una obra cerrada respeta el limite; editar una existente no", async () => {
  const cerrada = await prisma.obra.findFirstOrThrow({ where: { tenantId, estado: "cerrada" } });
  assert.equal((await pedir("PATCH", `/api/obras/${cerrada.id}`, { estado: "en_ejecucion" })).status, 403);
  await obra("Extra1", "planeada");
  await obra("Extra2", "planeada"); // 5 de 3 tras bajar de plan
  const activa = await prisma.obra.findFirstOrThrow({ where: { tenantId, nombre: "A" } });
  assert.equal((await pedir("PATCH", `/api/obras/${activa.id}`, { nombre: "A renombrada" })).status, 200);
});

test("usuarios: solo cuentan los activos; crear y reactivar respetan el limite", async () => {
  const inactivo = await prisma.usuario.create({ data: { tenantId, email: "inactivo@limites.test", passwordHash: "x", rolId, activo: false } });
  for (let i = 0; i < 9; i++) await prisma.usuario.create({ data: { tenantId, email: `u${i}@limites.test`, passwordHash: "x", rolId } });
  const r = await pedir("POST", "/api/usuarios", { email: "once@limites.test", password: "Segura#2026x", rolId });
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /10 usuarios/);
  assert.equal((await pedir("PATCH", `/api/usuarios/${inactivo.id}`, { activo: true })).status, 403);
});

test("plan empresa no tiene limite", async () => {
  await prisma.tenant.update({ where: { id: tenantId }, data: { plan: "empresa" } });
  assert.equal((await pedir("POST", "/api/obras", { nombre: "Sin limite" })).status, 201);
  assert.equal((await pedir("POST", "/api/usuarios", { email: "once@limites.test", password: "Segura#2026x", rolId })).status, 201);
});
