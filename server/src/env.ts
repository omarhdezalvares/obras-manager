import "dotenv/config";
import path from "path";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

// En produccion no hay fallback: un secreto conocido permitiria firmar tokens de cualquier tenant.
const isProd = process.env.NODE_ENV === "production";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  jwtAccessSecret: required("JWT_ACCESS_SECRET", isProd ? undefined : "obra-os-dev-access-secret-change-me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", isProd ? undefined : "obra-os-dev-refresh-secret-change-me"),
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads"),
};
