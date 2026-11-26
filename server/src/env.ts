import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

// En produccion no hay fallback: un secreto conocido permitiria firmar tokens de cualquier tenant.
const isProd = process.env.NODE_ENV === "production";

// Correos de super admin: separados por coma, sin distinguir mayusculas; vacia = nadie.
export function listaSuperAdmins(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  jwtAccessSecret: required("JWT_ACCESS_SECRET", isProd ? undefined : "obra-os-dev-access-secret-change-me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", isProd ? undefined : "obra-os-dev-refresh-secret-change-me"),
  // Supabase Storage: obligatorio en produccion; en tests se omite si no se suben archivos.
  supabaseUrl: required("SUPABASE_URL", isProd ? undefined : ""),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY", isProd ? undefined : ""),
  storageBucket: process.env.STORAGE_BUCKET ?? "evidencias",
  // Base de los links en correos; nunca del header Host, que el cliente controla.
  appUrl: process.env.APP_URL ?? (process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : "http://localhost:5173"),
  // Sin key, en local los correos se imprimen en consola; en produccion fallan.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  correoRemitente: process.env.CORREO_REMITENTE ?? "Bitácora <onboarding@resend.dev>",
  isProd,
  // Cobro: sin todas las variables el servidor arranca y /api/facturacion responde "Cobro no configurado".
  stripe: stripeConfig(),
  superAdminEmails: listaSuperAdmins(process.env.SUPERADMIN_EMAILS),
};

function stripeConfig() {
  const v = {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    basico: process.env.STRIPE_PRICE_BASICO,
    profesional: process.env.STRIPE_PRICE_PROFESIONAL,
    empresa: process.env.STRIPE_PRICE_EMPRESA,
    ivaTaxRate: process.env.STRIPE_TAX_RATE_IVA,
  };
  if (!v.secretKey || !v.webhookSecret || !v.basico || !v.profesional || !v.empresa || !v.ivaTaxRate) return null;
  return {
    secretKey: v.secretKey,
    webhookSecret: v.webhookSecret,
    precios: { basico: v.basico, profesional: v.profesional, empresa: v.empresa },
    ivaTaxRate: v.ivaTaxRate,
  };
}
