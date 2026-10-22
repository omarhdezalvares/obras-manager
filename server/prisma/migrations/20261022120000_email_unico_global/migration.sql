-- DropIndex
DROP INDEX "Usuario_tenantId_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

