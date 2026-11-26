-- Panel de super admin: giro, canal y primer pago real para tendencias.
ALTER TABLE "Tenant" ADD COLUMN "primerPagoAt" TIMESTAMP(3), ADD COLUMN "giro" TEXT, ADD COLUMN "canal" TEXT, ADD COLUMN "canalDetalle" TEXT;
ALTER TABLE "RegistroPendiente" ADD COLUMN "giro" TEXT, ADD COLUMN "canal" TEXT, ADD COLUMN "canalDetalle" TEXT;
