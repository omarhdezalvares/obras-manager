import "dotenv/config";
import path from "path";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "obra-os-dev-access-secret-change-me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "obra-os-dev-refresh-secret-change-me"),
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads"),
};
