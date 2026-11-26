// Crea la cuenta de un super admin en la empresa interna "Bitácora interna" (la crea si falta).
// Uso: SUPERADMIN_PASSWORD=... npx tsx scripts/crear-superadmin.ts --email socio@dominio.mx
// La contrasena nunca se imprime. El acceso al panel lo da SUPERADMIN_EMAILS, no este script.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { crearEmpresa } from "../src/lib/empresa";
import { hashPassword } from "../src/lib/password";
import { ROLES } from "../src/lib/roles";
import { esSuperAdmin } from "../src/middleware/superAdmin";

const i = process.argv.indexOf("--email");
const email = (i > 0 ? process.argv[i + 1] : "")?.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;

async function main() {
  if (!email || !email.includes("@")) throw new Error("Falta --email <correo>");
  if (!password) throw new Error("Falta SUPERADMIN_PASSWORD en el entorno");
  if (await prisma.usuario.findUnique({ where: { email } })) {
    console.log(`${email}: ya existe, no se cambió nada`);
    return;
  }
  const passwordHash = await hashPassword(password);
  const interna = await prisma.tenant.findFirst({ where: { slug: { startsWith: "bitacora-interna" } } });
  if (!interna) {
    const u = await crearEmpresa({ empresa: "Bitácora interna", email, passwordHash });
    // Piloto: nunca entra en prueba, gracia ni solo lectura.
    await prisma.tenant.update({ where: { id: u.tenantId }, data: { plan: "piloto", vigenteHasta: null } });
    console.log(`${email}: creado junto con la empresa interna`);
  } else {
    const rol = await prisma.rol.findUniqueOrThrow({ where: { tenantId_nombre: { tenantId: interna.id, nombre: ROLES.ADMIN } } });
    await prisma.usuario.create({ data: { tenantId: interna.id, email, passwordHash, rolId: rol.id } });
    console.log(`${email}: creado en la empresa interna`);
  }
  if (!esSuperAdmin(email)) console.log(`Aviso: ${email} no está en SUPERADMIN_EMAILS; no verá el panel hasta agregarlo.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
