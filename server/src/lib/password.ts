import bcrypt from "bcryptjs";
import { z } from "zod";

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

// Regla unica de contrasena segura (registro, restablecer y alta por el admin); el login no la aplica.
export const passwordSegura = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede pasar de 72 caracteres")
  .regex(/[a-z]/, "La contraseña debe incluir una minúscula")
  .regex(/[A-Z]/, "La contraseña debe incluir una mayúscula")
  .regex(/[0-9]/, "La contraseña debe incluir un número")
  .regex(/[^A-Za-z0-9]/, "La contraseña debe incluir un símbolo");
