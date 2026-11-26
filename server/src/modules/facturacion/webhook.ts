import { Request, Response } from "express";
import type Stripe from "stripe";
import { env } from "../../env";
import { prisma } from "../../lib/prisma";
import { writeAuditLog } from "../../lib/audit";
import { planDePrecio, stripe } from "../../lib/stripe";

const idDe = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : (x?.id ?? null));

// El tenant viaja en metadata de la suscripcion; si falta, se busca por el cliente de Stripe.
async function tenantPor(metaTenantId: string | undefined, customer: string | null): Promise<string | null> {
  if (metaTenantId) {
    const t = await prisma.tenant.findUnique({ where: { id: metaTenantId }, select: { id: true } });
    if (t) return t.id;
  }
  if (customer) {
    const t = await prisma.tenant.findUnique({ where: { stripeCustomerId: customer }, select: { id: true } });
    if (t) return t.id;
  }
  return null;
}

// Solo invoice.paid mueve plan y vigencia; reprocesar un evento deja el mismo resultado.
export async function aplicarEvento(evento: Stripe.Event): Promise<void> {
  const precios = env.stripe!.precios;
  switch (evento.type) {
    case "checkout.session.completed": {
      const s = evento.data.object;
      const tenantId = await tenantPor(s.client_reference_id ?? undefined, idDe(s.customer));
      if (!tenantId) return;
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId: idDe(s.customer), stripeSubscriptionId: idDe(s.subscription), metodoPago: "tarjeta" },
      });
      return;
    }
    case "invoice.paid": {
      const f = evento.data.object;
      const customer = idDe(f.customer);
      const tenantId = await tenantPor(f.subscription_details?.metadata?.tenantId, customer);
      if (!tenantId) return;
      // En una factura de prorrateo la linea positiva es la del plan nuevo.
      const linea = [...f.lines.data].reverse().find((l) => l.type === "subscription" && l.amount >= 0);
      if (!linea) return;
      const fin = new Date(linea.period.end * 1000);
      const plan = linea.price ? planDePrecio(precios, linea.price.id) : null;
      const antes = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      // Una factura vieja que llega tarde no retrocede la fecha ni el plan.
      const vieja = Boolean(antes.vigenteHasta && antes.vigenteHasta > fin);
      const vigenteHasta = vieja ? antes.vigenteHasta! : fin;
      const despues = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          vigenteHasta,
          ...(plan && !vieja ? { plan } : {}),
          origenPago: "stripe",
          stripeCustomerId: customer,
          stripeSubscriptionId: idDe(f.subscription) ?? antes.stripeSubscriptionId,
        },
      });
      if (antes.plan !== despues.plan || antes.vigenteHasta?.getTime() !== despues.vigenteHasta?.getTime()) {
        await writeAuditLog({
          tenantId,
          usuarioId: "stripe",
          entidadTipo: "Tenant",
          entidadId: tenantId,
          accion: "actualizar",
          cambios: { antes: { plan: antes.plan, vigenteHasta: antes.vigenteHasta }, despues: { plan: despues.plan, vigenteHasta: despues.vigenteHasta }, factura: f.id },
        });
      }
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const s = evento.data.object;
      const tenantId = await tenantPor(s.metadata?.tenantId, idDe(s.customer));
      if (!tenantId) return;
      const borrada = evento.type === "customer.subscription.deleted";
      await prisma.tenant.update({ where: { id: tenantId }, data: { stripeSubscriptionId: borrada ? null : s.id } });
      return;
    }
    default:
      return;
  }
}

// Montado con express.raw antes del parser JSON: la firma se calcula sobre el cuerpo exacto.
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  if (!env.stripe) {
    res.status(503).json({ error: "Cobro no configurado" });
    return;
  }
  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(req.body as Buffer, String(req.headers["stripe-signature"] ?? ""), env.stripe.webhookSecret);
  } catch {
    res.status(400).json({ error: "Firma de Stripe invalida" });
    return;
  }
  await aplicarEvento(evento);
  res.json({ recibido: true });
}
