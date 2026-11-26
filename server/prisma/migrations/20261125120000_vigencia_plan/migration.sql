-- Cobro con Stripe: vigencia y datos de suscripcion por empresa.
ALTER TABLE "Tenant" ADD COLUMN "vigenteHasta" TIMESTAMP(3),
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "metodoPago" TEXT,
ADD COLUMN "origenPago" TEXT;

CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");
CREATE UNIQUE INDEX "Tenant_stripeSubscriptionId_key" ON "Tenant"("stripeSubscriptionId");

-- Empresas en prueba: 14 dias desde su registro.
UPDATE "Tenant" SET "vigenteHasta" = "createdAt" + interval '14 days' WHERE "plan" = 'trial';
