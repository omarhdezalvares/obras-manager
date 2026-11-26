import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { usarSchemaDeTest } from "../testDb";

usarSchemaDeTest("test_estado_cuenta");

let server: Server;
let base = "";
let token = "";
let tenantId = "";
let prisma: typeof import("../lib/prisma").prisma;
const DIA = 86_400_000;

before(async () => {
  execSync("npx prisma db push --force-reset --skip-generate", { cwd: path.resolve(__dirname, "../.."), env: process.env, stdio: "ignore" });
  ({ prisma } = await import("../lib/prisma"));
  const { crearEmpresa } = await import("../lib/empresa");
  const { signAccessToken } = await import("../lib/jwt");
  const u = await crearEmpresa({ empresa: "Estado Cuenta SA", email: "admin@estado.test", passwordHash: "x" });
  tenantId = u.tenantId;
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
  fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

const vigencia = (dias: number, activo = true) =>
  prisma.tenant.update({ where: { id: tenantId }, data: { plan: "basico", vigenteHasta: new Date(Date.now() + dias * DIA), activo } });

test("solo lectura bloquea escrituras y deja leer y exportar", async () => {
  await vigencia(-10);
  const r = await pedir("POST", "/api/obras", { nombre: "Obra nueva" });
  assert.equal(r.status, 402);
  assert.equal((await r.json()).estado, "solo_lectura");
  assert.equal((await pedir("GET", "/api/obras")).status, 200);
  assert.notEqual((await pedir("POST", "/api/reportes/nada/exportar", {})).status, 402, "exportar sigue permitido");
});

test("en gracia todo funciona", async () => {
  await vigencia(-3);
  assert.notEqual((await pedir("POST", "/api/obras", { nombre: "En gracia" })).status, 402);
});

test("empresa suspendida no entra aunque el token sea valido", async () => {
  await vigencia(10, false);
  assert.equal((await pedir("GET", "/api/obras")).status, 403);
  await vigencia(10, true);
});
