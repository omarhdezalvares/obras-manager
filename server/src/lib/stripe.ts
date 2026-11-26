import Stripe from "stripe";
import { env } from "../env";
import { HttpError } from "../middleware/auth";
import type { Plan } from "./plan";

export type PlanPagado = Exclude<Plan, "trial" | "piloto">;
export type Precios = Record<PlanPagado, string>;
export type StripeConfig = NonNullable<typeof env.stripe>;

let cliente: Stripe | null = null;
export function stripe(): Stripe {
  if (!env.stripe) throw new HttpError(503, "Cobro no configurado");
  cliente ??= new Stripe(env.stripe.secretKey);
  return cliente;
}

export function planDePrecio(precios: Precios, priceId: string): PlanPagado | null {
  const par = (Object.entries(precios) as [PlanPagado, string][]).find(([, id]) => id === priceId);
  return par ? par[0] : null;
}

// Stripe exige que trial_end quede al menos 48 h en el futuro; con menos margen se cobra desde hoy.
const MARGEN_PRUEBA_MS = 48 * 3_600_000;

export interface ParamsSuscripcion {
  items: { price: string }[];
  default_tax_rates: string[];
  metadata: { tenantId: string };
  trial_end?: number;
}

export function paramsSuscripcion(
  cfg: Pick<StripeConfig, "precios" | "ivaTaxRate">,
  t: { id: string; vigenteHasta: Date | null },
  plan: PlanPagado,
  ahora = new Date()
): ParamsSuscripcion {
  const params: ParamsSuscripcion = {
    items: [{ price: cfg.precios[plan] }],
    default_tax_rates: [cfg.ivaTaxRate],
    metadata: { tenantId: t.id },
  };
  if (t.vigenteHasta && t.vigenteHasta.getTime() > ahora.getTime() + MARGEN_PRUEBA_MS) {
    params.trial_end = Math.floor(t.vigenteHasta.getTime() / 1000);
  }
  return params;
}
