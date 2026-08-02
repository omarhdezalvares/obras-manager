import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

async function main() {
  const email = required("ADMIN_EMAIL");
  const password = required("ADMIN_PASSWORD");
  const tenantNombre = process.env.ADMIN_TENANT_NOMBRE ?? "Empresa";
  const tenantSlug = process.env.ADMIN_TENANT_SLUG ?? "empresa";

  const passwordHash = await bcrypt.hash(password, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {},
    create: { nombre: tenantNombre, slug: tenantSlug, plan: "piloto" },
  });

  const rol = await prisma.rol.upsert({
    where: { tenantId_nombre: { tenantId: tenant.id, nombre: "Administrador" } },
    update: {},
    create: { tenantId: tenant.id, nombre: "Administrador" },
  });

  const usuario = await prisma.usuario.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { passwordHash, rolId: rol.id, activo: true },
    create: { tenantId: tenant.id, email, passwordHash, rolId: rol.id },
  });

  console.log(`Usuario admin listo: ${usuario.email} (tenant: ${tenant.slug})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
