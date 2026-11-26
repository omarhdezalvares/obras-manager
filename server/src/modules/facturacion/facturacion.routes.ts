import { Router } from "express";
import { z } from "zod";
import { env } from "../../env";
import { asyncHandler } from "../../middleware/errorHandler";
import { HttpError, requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";
import { estadoCuenta, finDeGracia, limitesDe } from "../../lib/plan";
import { uso } from "../../lib/limites";
import { decidirCheckout, paramsSuscripcion, PlanPagado, planDePrecio, stripe } from "../../lib/stripe";
import { ROLES } from "../../lib/roles";

export const facturacionRouter = Router();
facturacionRouter.use(requireAuth);

const tenantDe = (tenantId: string) => prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

// Infinity no existe en JSON: sin limite viaja como null.
const sinInfinito = (n: number) => (Number.isFinite(n) ? n : null);

facturacionRouter.get(
  "/estado",
  asyncHandler(async (req, res) => {
    const t = await tenantDe(req.user!.tenantId);
    const lim = limitesDe(t.plan);
    res.json({
      plan: t.plan,
      estado: estadoCuenta(t),
      vigenteHasta: t.vigenteHasta,
      finGracia: t.vigenteHasta ? finDeGracia(t.vigenteHasta) : null,
      metodoPago: t.metodoPago,
      tieneSuscripcion: Boolean(t.stripeSubscriptionId),
      limites: { obras: sinInfinito(lim.obras), usuarios: sinInfinito(lim.usuarios) },
      uso: await uso(t.id),
      cobroConfigurado: Boolean(env.stripe),
    });
  })
);

const planSchema = z.object({ plan: z.enum(["basico", "profesional", "empresa"]) });
const soloAdmin = requireRole(ROLES.ADMIN);
const cfg = () => {
  if (!env.stripe) throw new HttpError(503, "Cobro no configurado");
  return env.stripe;
};

async function clienteDe(t: { id: string; nombre: string; stripeCustomerId: string | null }, email: string): Promise<string> {
  if (t.stripeCustomerId) return t.stripeCustomerId;
  const c = await stripe().customers.create({ name: t.nombre, email, preferred_locales: ["es"], metadata: { tenantId: t.id } });
  await prisma.tenant.update({ where: { id: t.id }, data: { stripeCustomerId: c.id } });
  return c.id;
}

function sinSuscripcion(t: { stripeSubscriptionId: string | null }): void {
  if (t.stripeSubscriptionId) throw new HttpError(409, "La empresa ya tiene una suscripción; usa Cambiar plan o Administrar pago");
}

facturacionRouter.post(
  "/checkout",
  soloAdmin,
  asyncHandler(async (req, res) => {
    const c = cfg();
    const { plan } = planSchema.parse(req.body);
    const t = await tenantDe(req.user!.tenantId);
    sinSuscripcion(t);
    const customer = await clienteDe(t, req.user!.email);
    // El id de la suscripcion llega por webhook: mientras tanto se pregunta a Stripe para no cobrar dos veces.
    const [subs, sesiones] = await Promise.all([
      stripe().subscriptions.list({ customer, status: "all", limit: 20 }),
      stripe().checkout.sessions.list({ customer, status: "open", limit: 5 }),
    ]);
    const decision = decidirCheckout(subs.data, sesiones.data);
    if (decision.tipo === "ya_suscrita") throw new HttpError(409, "La empresa ya tiene una suscripción; usa Cambiar plan o Administrar pago");
    if (decision.tipo === "reusar") {
      res.json({ url: decision.url });
      return;
    }
    // Checkout recibe el precio en line_items; IVA, metadata y prueba van en subscription_data.
    const { items, ...subscription_data } = paramsSuscripcion(c, t, plan);
    const sesion = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: t.id,
      locale: "es",
      line_items: items.map((i) => ({ price: i.price, quantity: 1 })),
      subscription_data,
      success_url: `${env.appUrl}/plan?pago=ok`,
      cancel_url: `${env.appUrl}/plan?pago=cancelado`,
    });
    res.json({ url: sesion.url });
  })
);

facturacionRouter.post(
  "/transferencia",
  soloAdmin,
  asyncHandler(async (req, res) => {
    const c = cfg();
    const { plan } = planSchema.parse(req.body);
    const t = await tenantDe(req.user!.tenantId);
    sinSuscripcion(t);
    const customer = await clienteDe(t, req.user!.email);
    const sub = await stripe().subscriptions.create({
      customer,
      ...paramsSuscripcion(c, t, plan),
      collection_method: "send_invoice",
      days_until_due: 5,
      payment_settings: { payment_method_types: ["customer_balance"] },
      expand: ["latest_invoice"],
    });
    await prisma.tenant.update({ where: { id: t.id }, data: { stripeSubscriptionId: sub.id, metodoPago: "transferencia" } });
    let factura = sub.latest_invoice && typeof sub.latest_invoice !== "string" ? sub.latest_invoice : null;
    // La primera factura nace en borrador: se finaliza ya. La de $0 (en prueba) queda pagada al finalizar y no se envia.
    if (factura?.id && factura.status === "draft") {
      factura = await stripe().invoices.finalizeInvoice(factura.id);
      if (factura.id && factura.status === "open" && factura.amount_due > 0) await stripe().invoices.sendInvoice(factura.id);
    }
    res.json({ facturaUrl: factura?.amount_due ? (factura.hosted_invoice_url ?? null) : null });
  })
);

const ORDEN: Record<PlanPagado, number> = { basico: 1, profesional: 2, empresa: 3 };

facturacionRouter.post(
  "/cambiar-plan",
  soloAdmin,
  asyncHandler(async (req, res) => {
    const c = cfg();
    const { plan } = planSchema.parse(req.body);
    const t = await tenantDe(req.user!.tenantId);
    if (!t.stripeSubscriptionId) throw new HttpError(409, "La empresa no tiene suscripción");
    const sub = await stripe().subscriptions.retrieve(t.stripeSubscriptionId);
    const item = sub.items.data[0];
    const actual = planDePrecio(c.precios, item.price.id);
    if (actual === plan) throw new HttpError(409, "Ya tienes ese plan");
    const sube = !actual || ORDEN[plan] > ORDEN[actual];
    // Subir: se factura la diferencia hoy y el plan cambia al pagarla. Bajar: el precio nuevo entra en la siguiente factura.
    await stripe().subscriptions.update(sub.id, {
      items: [{ id: item.id, price: c.precios[plan] }],
      proration_behavior: sube ? "always_invoice" : "none",
    });
    res.json({ ok: true, aplica: sube ? "al_pagar" : "siguiente_periodo" });
  })
);

facturacionRouter.post(
  "/portal",
  soloAdmin,
  asyncHandler(async (req, res) => {
    cfg();
    const t = await tenantDe(req.user!.tenantId);
    if (!t.stripeCustomerId) throw new HttpError(409, "La empresa todavía no tiene datos de pago");
    const sesion = await stripe().billingPortal.sessions.create({ customer: t.stripeCustomerId, return_url: `${env.appUrl}/plan`, locale: "es" });
    res.json({ url: sesion.url });
  })
);
