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
let jefeId = "";
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
  jefeId = jefe.id;
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

const AVISO_STRIPE = "Esta empresa paga con Stripe; el cambio se revierte en su próximo cobro.";
const fechaEn = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
const empresa = () => prisma.tenant.findUniqueOrThrow({ where: { id: tenantCliente } });

test("pago manual: fija plan y vigencia, marca manual y primer pago, y queda en el historial", async () => {
  const r = await pedir("POST", `/admin/empresas/${tenantCliente}/pago-manual`, tokenJefe, { plan: "profesional", hasta: fechaEn(30), monto: 3120.4, nota: "transferencia directa" });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, aviso: null });
  const t = await empresa();
  assert.equal(t.plan, "profesional");
  assert.equal(t.origenPago, "manual");
  assert.equal(t.metodoPago, "manual");
  assert.ok(t.primerPagoAt);
  assert.equal(t.vigenteHasta?.toISOString(), `${fechaEn(30)}T23:59:59.999Z`);
  const log = await prisma.auditLog.findFirstOrThrow({ where: { tenantId: tenantCliente, accion: "pago_manual" } });
  assert.equal(log.usuarioId, jefeId);
  assert.match(log.cambios ?? "", /transferencia directa/);
});

test("pago manual: fecha pasada o invalida responde 400", async () => {
  assert.equal((await pedir("POST", `/admin/empresas/${tenantCliente}/pago-manual`, tokenJefe, { plan: "basico", hasta: fechaEn(-1) })).status, 400);
  assert.equal((await pedir("POST", `/admin/empresas/${tenantCliente}/pago-manual`, tokenJefe, { plan: "basico", hasta: "2026-13-45" })).status, 400);
  assert.equal((await pedir("POST", `/admin/empresas/${tenantCliente}/pago-manual`, tokenJefe, { plan: "oro", hasta: fechaEn(5) })).status, 400);
});

test("ficha: uso, limites e historial con quien hizo cada cambio", async () => {
  const r = await pedir("GET", `/admin/empresas/${tenantCliente}`, tokenJefe);
  assert.equal(r.status, 200);
  const d = (await r.json()) as { nombre: string; uso: { obras: number }; limites: { obras: number | null }; historial: { accion: string; quien: string }[]; tieneSuscripcion: boolean };
  assert.equal(d.nombre, "Cliente SA");
  assert.equal(d.uso.obras, 0);
  assert.equal(d.limites.obras, 10);
  assert.equal(d.tieneSuscripcion, false);
  assert.deepEqual(d.historial[0], { ...d.historial[0], accion: "pago_manual", quien: "jefe@bitacora.test" });
  assert.equal((await pedir("GET", `/admin/empresas/${tenantJefe}`, tokenJefe)).status, 404);
  assert.equal((await pedir("GET", "/admin/empresas/no-existe", tokenJefe)).status, 404);
});

test("cambiar plan y pago manual avisan si la empresa paga con Stripe", async () => {
  await prisma.tenant.update({ where: { id: tenantCliente }, data: { stripeSubscriptionId: "sub_admin" } });
  const r = await pedir("PATCH", `/admin/empresas/${tenantCliente}/plan`, tokenJefe, { plan: "empresa" });
  assert.equal(r.status, 200);
  assert.equal(((await r.json()) as { aviso: string }).aviso, AVISO_STRIPE);
  assert.equal((await empresa()).plan, "empresa");
  const p = await pedir("POST", `/admin/empresas/${tenantCliente}/pago-manual`, tokenJefe, { plan: "basico", hasta: fechaEn(10) });
  assert.equal(((await p.json()) as { aviso: string }).aviso, AVISO_STRIPE);
  await prisma.tenant.update({ where: { id: tenantCliente }, data: { stripeSubscriptionId: null } });
});

test("suspender: la empresa interna no se toca y el cliente suspendido no entra", async () => {
  assert.equal((await pedir("PATCH", `/admin/empresas/${tenantJefe}/activo`, tokenJefe, { activo: false })).status, 404);
  assert.equal((await pedir("PATCH", `/admin/empresas/${tenantCliente}/activo`, tokenJefe, { activo: false })).status, 200);
  assert.equal((await empresa()).activo, false);
  assert.equal((await pedir("GET", "/obras", tokenCliente)).status, 403);
  assert.equal((await pedir("PATCH", `/admin/empresas/${tenantCliente}/activo`, tokenJefe, { activo: true })).status, 200);
  assert.equal((await pedir("GET", "/obras", tokenCliente)).status, 200);
  assert.ok(await prisma.auditLog.findFirst({ where: { tenantId: tenantCliente, accion: "suspender", usuarioId: jefeId } }));
});

test("corregir giro y canal valida con las listas", async () => {
  assert.equal((await pedir("PATCH", `/admin/empresas/${tenantCliente}/marketing`, tokenJefe, { canal: "Otro" })).status, 400);
  assert.equal((await pedir("PATCH", `/admin/empresas/${tenantCliente}/marketing`, tokenJefe, { giro: "Carpintería" })).status, 400);
  assert.equal((await pedir("PATCH", `/admin/empresas/${tenantCliente}/marketing`, tokenJefe, { giro: "Voz y datos", canal: "Otro", canalDetalle: "Expo CDMX" })).status, 200);
  const t = await empresa();
  assert.deepEqual([t.giro, t.canal, t.canalDetalle], ["Voz y datos", "Otro", "Expo CDMX"]);
});

test("un cliente recibe 404 en todas las acciones", async () => {
  assert.equal((await pedir("GET", `/admin/empresas/${tenantCliente}`, tokenCliente)).status, 404);
  assert.equal((await pedir("POST", `/admin/empresas/${tenantCliente}/pago-manual`, tokenCliente, { plan: "empresa", hasta: fechaEn(300) })).status, 404);
  assert.equal((await pedir("PATCH", `/admin/empresas/${tenantCliente}/plan`, tokenCliente, { plan: "empresa" })).status, 404);
  assert.equal((await pedir("PATCH", `/admin/empresas/${tenantCliente}/activo`, tokenCliente, { activo: true })).status, 404);
  assert.equal((await pedir("PATCH", `/admin/empresas/${tenantCliente}/marketing`, tokenCliente, { giro: "Otro" })).status, 404);
});

test("tendencias por periodo excluye empresas fuera de rango y la interna", async () => {
  const vieja = await (await import("../../lib/empresa")).crearEmpresa({ empresa: "Vieja SA", email: "admin@vieja.test", passwordHash: "x", giro: "Plomería", canal: "Google" });
  await prisma.tenant.update({ where: { id: vieja.tenantId }, data: { createdAt: new Date(Date.now() - 60 * 86_400_000) } });
  const total = (d: { porGiro: { registros: number }[] }) => d.porGiro.reduce((s, f) => s + f.registros, 0);
  const r30 = await pedir("GET", "/admin/tendencias?periodo=30d", tokenJefe);
  assert.equal(r30.status, 200);
  assert.equal(total((await r30.json()) as { porGiro: { registros: number }[] }), 1);
  const rTodo = (await (await pedir("GET", "/admin/tendencias?periodo=todo", tokenJefe)).json()) as { porGiro: { registros: number }[] };
  assert.equal(total(rTodo), 2);
  assert.equal((await pedir("GET", "/admin/tendencias?periodo=xx", tokenJefe)).status, 400);
  assert.equal((await pedir("GET", "/admin/tendencias", tokenCliente)).status, 404);
});
