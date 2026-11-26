import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import Stripe from "stripe";
import { usarSchemaDeTest } from "../../testDb";

usarSchemaDeTest("test_webhook");
const SECRETO = "whsec_prueba_local";
Object.assign(process.env, {
  STRIPE_SECRET_KEY: "sk_test_falsa",
  STRIPE_WEBHOOK_SECRET: SECRETO,
  STRIPE_PRICE_BASICO: "price_b",
  STRIPE_PRICE_PROFESIONAL: "price_p",
  STRIPE_PRICE_EMPRESA: "price_e",
  STRIPE_TAX_RATE_IVA: "txr_iva",
});

let server: Server;
let base = "";
let tenantId = "";
let prisma: typeof import("../../lib/prisma").prisma;
const firmador = new Stripe("sk_test_falsa");
const seg = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

before(async () => {
  execSync("npx prisma db push --force-reset --skip-generate", { cwd: path.resolve(__dirname, "../../.."), env: process.env, stdio: "ignore" });
  ({ prisma } = await import("../../lib/prisma"));
  const { crearEmpresa } = await import("../../lib/empresa");
  const u = await crearEmpresa({ empresa: "Webhook SA", email: "admin@webhook.test", passwordHash: "x" });
  tenantId = u.tenantId;
  await prisma.tenant.update({ where: { id: tenantId }, data: { vigenteHasta: new Date("2026-12-09T00:00:00Z") } });
  const { app } = await import("../../app");
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await prisma.$disconnect();
});

function enviar(evento: object, secreto = SECRETO) {
  const payload = JSON.stringify(evento);
  const header = firmador.webhooks.generateTestHeaderString({ payload, secret: secreto });
  return fetch(`${base}/api/facturacion/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });
}

const facturaPagada = (id: string, price: string, fin: string, meta: Record<string, string> = { tenantId: "" }, amountPaid = 149640, creado = "2026-12-09T00:00:00Z") => ({
  id: `evt_${id}`,
  object: "event",
  type: "invoice.paid",
  created: seg(creado),
  data: {
    object: {
      id: `in_${id}`,
      object: "invoice",
      amount_paid: amountPaid,
      customer: "cus_1",
      subscription: "sub_1",
      subscription_details: { metadata: meta },
      lines: { data: [{ type: "subscription", amount: 149640, price: { id: price }, period: { start: seg("2026-12-09"), end: seg(fin) } }] },
    },
  },
});

const tenant = () => prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

test("invoice.paid antes de checkout liga la empresa por metadata y mueve plan y vigencia", async () => {
  const r = await enviar(facturaPagada("1", "price_p", "2027-01-15", { tenantId }));
  assert.equal(r.status, 200);
  const t = await tenant();
  assert.equal(t.plan, "profesional");
  assert.equal(t.vigenteHasta?.toISOString(), new Date("2027-01-15").toISOString());
  assert.equal(t.origenPago, "stripe");
  assert.equal(t.stripeCustomerId, "cus_1");
  assert.equal(t.stripeSubscriptionId, "sub_1");
});

test("el mismo evento dos veces no cambia nada y un periodo viejo no retrocede la fecha", async () => {
  await enviar(facturaPagada("1", "price_p", "2027-01-15", { tenantId }));
  await enviar(facturaPagada("0", "price_b", "2026-12-20", { tenantId }));
  const t = await tenant();
  assert.equal(t.vigenteHasta?.toISOString(), new Date("2027-01-15").toISOString());
});

test("la factura $0 de la prueba aplica el plan aunque la vigencia tenga milisegundos", async () => {
  const otra = (await import("../../lib/empresa")).crearEmpresa;
  const u = await otra({ empresa: "Prueba Ms SA", email: "admin@ms.test", passwordHash: "x" });
  await prisma.tenant.update({ where: { id: u.tenantId }, data: { vigenteHasta: new Date("2026-12-10T18:33:36.231Z") } });
  const evento = facturaPagada("ms", "price_b", "2026-12-10T18:33:36Z", { tenantId: u.tenantId });
  evento.data.object.customer = "cus_ms";
  evento.data.object.subscription = "sub_ms";
  evento.data.object.lines.data[0].amount = 0;
  await enviar(evento);
  assert.equal((await prisma.tenant.findUniqueOrThrow({ where: { id: u.tenantId } })).plan, "basico");
});

test("primerPagoAt: la factura $0 no cuenta, la primera con monto si y no cambia despues", async () => {
  const u = await (await import("../../lib/empresa")).crearEmpresa({ empresa: "Primer Pago SA", email: "admin@pp.test", passwordHash: "x" });
  const t = () => prisma.tenant.findUniqueOrThrow({ where: { id: u.tenantId } });
  await enviar(facturaPagada("pp0", "price_b", "2027-01-01", { tenantId: u.tenantId }, 0, "2026-12-01T00:00:00Z"));
  assert.equal((await t()).primerPagoAt, null);
  await enviar(facturaPagada("pp1", "price_b", "2027-02-01", { tenantId: u.tenantId }, 149640, "2027-01-01T00:00:00Z"));
  assert.equal((await t()).primerPagoAt?.toISOString(), "2027-01-01T00:00:00.000Z");
  await enviar(facturaPagada("pp2", "price_b", "2027-03-01", { tenantId: u.tenantId }, 149640, "2027-02-01T00:00:00Z"));
  assert.equal((await t()).primerPagoAt?.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("checkout completado guarda ids y metodo tarjeta", async () => {
  await enviar({ id: "evt_c", object: "event", type: "checkout.session.completed", data: { object: { id: "cs_1", object: "checkout.session", client_reference_id: tenantId, customer: "cus_1", subscription: "sub_1" } } });
  assert.equal((await tenant()).metodoPago, "tarjeta");
});

test("firma alterada responde 400 y cliente desconocido 200 sin cambios", async () => {
  assert.equal((await enviar(facturaPagada("x", "price_e", "2030-01-01", { tenantId }), "whsec_otro")).status, 400);
  const otro = { ...facturaPagada("y", "price_e", "2030-01-01", {}), };
  (otro.data.object as { customer: string }).customer = "cus_desconocido";
  assert.equal((await enviar(otro)).status, 200);
  assert.equal((await tenant()).plan, "profesional");
});

test("suscripcion borrada quita el id y deja la vigencia", async () => {
  await enviar({ id: "evt_d", object: "event", type: "customer.subscription.deleted", data: { object: { id: "sub_1", object: "subscription", customer: "cus_1", metadata: { tenantId } } } });
  const t = await tenant();
  assert.equal(t.stripeSubscriptionId, null);
  assert.equal(t.vigenteHasta?.toISOString(), new Date("2027-01-15").toISOString());
});

test("subir de plan: la factura de prorrateo cambia el plan aunque sus lineas no sean de tipo subscription", async () => {
  const antes = await tenant();
  const fin = antes.vigenteHasta!.toISOString();
  const evento = facturaPagada("up", "price_e", fin, { tenantId });
  evento.data.object.lines.data = [
    { type: "invoiceitem", proration: true, amount: -50000, price: { id: "price_p" }, period: { start: seg("2026-12-20"), end: seg(fin) } },
    { type: "invoiceitem", proration: true, amount: 120000, price: { id: "price_e" }, period: { start: seg("2026-12-20"), end: seg(fin) } },
  ] as never;
  await enviar(evento);
  assert.equal((await tenant()).plan, "empresa");
});

test("un updated reintentado despues del deleted no revive la suscripcion cancelada", async () => {
  await prisma.tenant.update({ where: { id: tenantId }, data: { stripeSubscriptionId: "sub_2" } });
  await enviar({ id: "evt_d2", object: "event", type: "customer.subscription.deleted", data: { object: { id: "sub_2", object: "subscription", status: "canceled", customer: "cus_1", metadata: { tenantId } } } });
  await enviar({ id: "evt_u2", object: "event", type: "customer.subscription.updated", data: { object: { id: "sub_2", object: "subscription", status: "canceled", customer: "cus_1", metadata: { tenantId } } } });
  assert.equal((await tenant()).stripeSubscriptionId, null);
});

test("deleted de otra suscripcion no borra la actual", async () => {
  await prisma.tenant.update({ where: { id: tenantId }, data: { stripeSubscriptionId: "sub_3" } });
  await enviar({ id: "evt_d3", object: "event", type: "customer.subscription.deleted", data: { object: { id: "sub_vieja", object: "subscription", status: "canceled", customer: "cus_1", metadata: { tenantId } } } });
  assert.equal((await tenant()).stripeSubscriptionId, "sub_3");
});
