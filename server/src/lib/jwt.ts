import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../env";

export interface AccessTokenClaims {
  sub: string; // usuario id
  tenantId: string;
  rol: string;
  personaId: string | null;
  email: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.jwtAccessSecret, { expiresIn: "15m" });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenClaims;
}

export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString("hex");
  const hash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
  return { token, hash, expiresAt };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
