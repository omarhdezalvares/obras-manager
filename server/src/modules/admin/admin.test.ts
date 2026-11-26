import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { usarSchemaDeTest } from "../../testDb";

usarSchemaDeTest("test_admin");
process.env.SUPERADMIN_EMAILS = " Jefe@Bitacora.test , ";
for (const k of Object.keys(process.env)) if (k.startsWith("STRIPE_")) delete process.env[k];

let server: Server;
let base = "";
let tokenJefe = "";
let tokenCliente = "";
let tenantJefe = "";
let tenantCliente = "";
let prisma: typeof import("../../lib/prisma").prisma;

before(async () => {
  execSync("npx prisma db push --force-reset --skip-generate", { cwd: path.resolve(__dirname, "../../.."), env: process.env, stdio: "ignore" });
  ({ prisma } = await import("../../lib/prisma"));
  const { crearEmpresa } = await import("../../lib/empresa");
  const { signAccessToken } = await import("../../lib/jwt");
  const jefe = await crearEmpresa({ empresa: "Bitácora interna", email: "jefe@bitacora.test", passwordHash: "x" });
  await prisma.tenant.update({ where: { id: jefe.tenantId }, data: { plan: "piloto" } });
  const cliente = await crearEmpresa({ empresa: "Cliente SA", email: "admin@cliente.test", passwordHash: "x", giro: "Plomería", canal: "Google" });
  tenantJefe = jefe.tenantId;
  tenantCliente = cliente.tenantId;
  tokenJefe = signAccessToken({ sub: jefe.id, tenantId: jefe.tenantId, rol: "Administrador", personaId: null, email: jefe.email });
  // Aunque el token diga que es el jefe, el correo se lee de la base.
  tokenCliente = signAccessToken({ sub: cliente.id, tenantId: cliente.tenantId, rol: "Administrador", personaId: null, email: "jefe@bitacora.test" });
  const { app } = await import("../../app");
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await prisma.$disconnect();
});

const pedir = (metodo: string, ruta: string, token: string, body?: unknown) =>
  fetch(`${base}/api${ruta}`, { method: metodo, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

test("lista de super admins: normaliza y una lista vacia no da acceso a nadie", async () => {
  const { esSuperAdmin, listaSuperAdmins } = await import("../../middleware/superAdmin");
  assert.deepEqual(listaSuperAdmins(" A@x.mx ,, b@y.mx "), ["a@x.mx", "b@y.mx"]);
  assert.deepEqual(listaSuperAdmins(undefined), []);
  assert.equal(esSuperAdmin("", []), false);
  assert.equal(esSuperAdmin("x@y.mx", []), false);
  assert.equal(esSuperAdmin(" JEFE@bitacora.test", ["jefe@bitacora.test"]), true);
});

test("un administrador de cliente recibe 404 aunque su token diga otro correo", async () => {
  assert.equal((await pedir("GET", "/admin/empresas", tokenCliente)).status, 404);
});

test("el super admin ve el tablero sin su empresa interna", async () => {
  const r = await pedir("GET", "/admin/empresas", tokenJefe);
  assert.equal(r.status, 200);
  const d = (await r.json()) as { contadores: Record<string, number>; empresas: { id: string; giro: string; adminEmail: string; estado: string }[] };
  assert.deepEqual(d.empresas.map((e) => e.id), [tenantCliente]);
  assert.equal(d.empresas[0].giro, "Plomería");
  assert.equal(d.empresas[0].adminEmail, "admin@cliente.test");
  assert.equal(d.empresas[0].estado, "prueba");
  assert.equal(d.contadores.prueba, 1);
  assert.equal(d.contadores.piloto, 0);
  assert.ok(!d.empresas.some((e) => e.id === tenantJefe));
});

test("/auth/me dice si es super admin", async () => {
  const jefe = (await (await pedir("GET", "/auth/me", tokenJefe)).json()) as { superAdmin: boolean };
  const cliente = (await (await pedir("GET", "/auth/me", tokenCliente)).json()) as { superAdmin: boolean };
  assert.equal(jefe.superAdmin, true);
  assert.equal(cliente.superAdmin, false);
});
