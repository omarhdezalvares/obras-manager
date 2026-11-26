import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { usarSchemaDeTest } from "../../testDb";

usarSchemaDeTest("test_facturacion");
for (const k of Object.keys(process.env)) if (k.startsWith("STRIPE_")) delete process.env[k];

let server: Server;
let base = "";
let tokenAdmin = "";
let tokenOficial = "";
let prisma: typeof import("../../lib/prisma").prisma;

before(async () => {
  execSync("npx prisma db push --force-reset --skip-generate", { cwd: path.resolve(__dirname, "../../.."), env: process.env, stdio: "ignore" });
  ({ prisma } = await import("../../lib/prisma"));
  const { crearEmpresa } = await import("../../lib/empresa");
  const { signAccessToken } = await import("../../lib/jwt");
  const u = await crearEmpresa({ empresa: "Facturacion SA", email: "admin@fact.test", passwordHash: "x" });
  tokenAdmin = signAccessToken({ sub: u.id, tenantId: u.tenantId, rol: "Administrador", personaId: null, email: u.email });
  tokenOficial = signAccessToken({ sub: u.id, tenantId: u.tenantId, rol: "Oficial", personaId: null, email: u.email });
  const { app } = await import("../../app");
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await prisma.$disconnect();
});

const pedir = (metodo: string, ruta: string, token: string, body?: unknown) =>
  fetch(`${base}/api/facturacion${ruta}`, { method: metodo, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

test("paramsSuscripcion conserva los dias de prueba y lleva IVA y tenant", async () => {
  const { paramsSuscripcion } = await import("../../lib/stripe");
  const cfg = { precios: { basico: "price_b", profesional: "price_p", empresa: "price_e" }, ivaTaxRate: "txr_iva" };
  const ahora = new Date("2026-12-01T00:00:00Z");
  const en10 = new Date(ahora.getTime() + 10 * 86_400_000);
  const p = paramsSuscripcion(cfg, { id: "t1", vigenteHasta: en10 }, "profesional", ahora);
  assert.deepEqual(p.items, [{ price: "price_p" }]);
  assert.deepEqual(p.default_tax_rates, ["txr_iva"]);
  assert.deepEqual(p.metadata, { tenantId: "t1" });
  assert.equal(p.trial_end, Math.floor(en10.getTime() / 1000));
  const en1 = new Date(ahora.getTime() + 86_400_000);
  assert.equal(paramsSuscripcion(cfg, { id: "t1", vigenteHasta: en1 }, "basico", ahora).trial_end, undefined, "Stripe pide 48 h de margen");
  assert.equal(paramsSuscripcion(cfg, { id: "t1", vigenteHasta: null }, "basico", ahora).trial_end, undefined);
});

test("planDePrecio mapea los tres precios", async () => {
  const { planDePrecio } = await import("../../lib/stripe");
  const precios = { basico: "price_b", profesional: "price_p", empresa: "price_e" };
  assert.equal(planDePrecio(precios, "price_b"), "basico");
  assert.equal(planDePrecio(precios, "price_e"), "empresa");
  assert.equal(planDePrecio(precios, "price_x"), null);
});

test("sin Stripe configurado: estado responde y las acciones dan 503", async () => {
  const r = await pedir("GET", "/estado", tokenOficial);
  assert.equal(r.status, 200);
  const e = await r.json();
  assert.equal(e.cobroConfigurado, false);
  assert.equal(e.plan, "trial");
  assert.equal(e.estado, "prueba");
  assert.deepEqual(e.uso, { obras: 0, usuarios: 1 });
  assert.deepEqual(e.limites, { obras: 3, usuarios: 10 });
  assert.equal((await pedir("POST", "/checkout", tokenAdmin, { plan: "basico" })).status, 503);
  assert.equal((await pedir("POST", "/portal", tokenAdmin)).status, 503);
});

test("solo el Administrador contrata", async () => {
  assert.equal((await pedir("POST", "/checkout", tokenOficial, { plan: "basico" })).status, 403);
});
