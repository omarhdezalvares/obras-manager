import bcrypt from "bcryptjs";

// Nota: el documento recomienda Argon2id para produccion. Esta version de
// test usa bcryptjs para evitar dependencias nativas y facilitar `npm install`
// en cualquier maquina sin toolchain de compilacion.
const SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
