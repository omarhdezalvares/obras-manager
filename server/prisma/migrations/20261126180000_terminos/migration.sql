ALTER TABLE "Tenant" ADD COLUMN "terminosVersion" TEXT, ADD COLUMN "terminosAceptadosAt" TIMESTAMP(3);
ALTER TABLE "RegistroPendiente" ADD COLUMN "terminosVersion" TEXT;
