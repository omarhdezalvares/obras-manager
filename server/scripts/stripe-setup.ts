// Deja lista la cuenta de Stripe de las llaves actuales (prueba o real). Idempotente: se puede correr varias veces.
// Uso: npx tsx scripts/stripe-setup.ts [--env ruta/.env] [--webhook-url https://.../api/facturacion/webhook]
// Escribe los IDs (y el secreto del webhook, si lo crea) en el .env indicado; nunca imprime llaves ni secretos.
import "dotenv/config";
import fs from "fs";
import Stripe from "stripe";

const arg = (nombre: string) => {
  const i = process.argv.indexOf(nombre);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const envPath = arg("--env") ?? ".env";
const webhookUrl = arg("--webhook-url");

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("Falta STRIPE_SECRET_KEY en el entorno");
const stripe = new Stripe(key);

const PLANES = [
  { lookup: "bitacora_basico", nombre: "Bitácora Básico", centavos: 129000, env: "STRIPE_PRICE_BASICO" },
  { lookup: "bitacora_profesional", nombre: "Bitácora Profesional", centavos: 269000, env: "STRIPE_PRICE_PROFESIONAL" },
  { lookup: "bitacora_empresa", nombre: "Bitácora Empresa", centavos: 549000, env: "STRIPE_PRICE_EMPRESA" },
];
const EVENTOS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "invoice.paid",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

function guardar(valores: Record<string, string>): void {
  let texto = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  for (const [k, v] of Object.entries(valores)) {
    const linea = `${k}="${v}"`;
    texto = new RegExp(`^${k}=.*$`, "m").test(texto) ? texto.replace(new RegExp(`^${k}=.*$`, "m"), linea) : `${texto.trimEnd()}\n${linea}\n`;
  }
  fs.writeFileSync(envPath, texto);
}

async function main() {
  const valores: Record<string, string> = {};

  for (const p of PLANES) {
    const existente = (await stripe.prices.list({ lookup_keys: [p.lookup], active: true })).data[0];
    const precio =
      existente ??
      (await stripe.prices.create({
        currency: "mxn",
        unit_amount: p.centavos,
        recurring: { interval: "month" },
        lookup_key: p.lookup,
        tax_behavior: "exclusive",
        product_data: { name: p.nombre },
      }));
    valores[p.env] = precio.id;
    console.log(`${p.nombre}: ${existente ? "ya existía" : "creado"} (${precio.id})`);
  }

  const iva =
    (await stripe.taxRates.list({ active: true, limit: 100 })).data.find((t) => t.display_name === "IVA" && t.percentage === 16 && !t.inclusive) ??
    (await stripe.taxRates.create({ display_name: "IVA", percentage: 16, inclusive: false, jurisdiction: "MX", country: "MX" }));
  valores.STRIPE_TAX_RATE_IVA = iva.id;
  console.log(`IVA 16%: ${iva.id}`);

  // Portal: cambiar entre los 3 planes (subir cobra la diferencia hoy, bajar al fin del periodo), tarjeta, facturas y cancelar al fin del periodo.
  const productos = await Promise.all(PLANES.map(async (p) => (await stripe.prices.retrieve(valores[p.env])).product as string));
  const portal = (await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 })).data[0];
  const ajustes: Stripe.BillingPortal.ConfigurationUpdateParams = {
    business_profile: { headline: "Bitácora: administra tu plan y tus pagos" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "always_invoice",
        products: productos.map((product, i) => ({ product, prices: [valores[PLANES[i].env]] })),
        schedule_at_period_end: { conditions: [{ type: "decreasing_item_amount" }] },
      },
    },
  };
  if (portal) await stripe.billingPortal.configurations.update(portal.id, ajustes);
  else await stripe.billingPortal.configurations.create(ajustes as Stripe.BillingPortal.ConfigurationCreateParams);
  console.log("Portal de clientes: configurado");

  if (webhookUrl) {
    const ya = (await stripe.webhookEndpoints.list({ limit: 100 })).data.find((w) => w.url === webhookUrl);
    if (ya) {
      await stripe.webhookEndpoints.update(ya.id, { enabled_events: EVENTOS });
      console.log("Webhook: ya existía (su secreto no se puede volver a leer; si falta, bórralo en Stripe y corre de nuevo)");
    } else {
      const nuevo = await stripe.webhookEndpoints.create({ url: webhookUrl, enabled_events: EVENTOS });
      valores.STRIPE_WEBHOOK_SECRET = nuevo.secret!;
      console.log("Webhook: creado, secreto guardado en " + envPath);
    }
  }

  guardar(valores);
  console.log(`Listo: IDs guardados en ${envPath}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
