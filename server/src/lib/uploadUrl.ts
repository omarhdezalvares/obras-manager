import crypto from "crypto";
import type { RequestHandler } from "express";
import { env } from "../env";

// Las <img> no mandan el header Authorization, asi que /uploads se protege con
// links firmados: solo los emite una ruta que ya valido acceso, y caducan.
const VENTANA_MS = 6 * 60 * 60 * 1000;

function firma(key: string, exp: number): string {
  return crypto.createHmac("sha256", env.jwtAccessSecret).update(`uploads:${key}:${exp}`).digest("base64url");
}

// exp se redondea a la ventana para que la URL sea estable unas horas y el navegador la cachee.
export function urlFirmada(key: string, ahora = Date.now()): string {
  const exp = (Math.floor(ahora / VENTANA_MS) + 2) * VENTANA_MS;
  return `/uploads/${key}?exp=${exp}&sig=${firma(key, exp)}`;
}

export function firmaValida(key: string, exp: string, sig: string, ahora = Date.now()): boolean {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < ahora) return false;
  const esperada = Buffer.from(firma(key, expNum));
  const recibida = Buffer.from(sig);
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

export const requireUploadFirmado: RequestHandler = (req, res, next) => {
  const key = decodeURIComponent(req.path.slice(1));
  const { exp, sig } = req.query;
  if (typeof exp !== "string" || typeof sig !== "string" || !firmaValida(key, exp, sig)) {
    res.status(403).json({ error: "Link de archivo invalido o expirado" });
    return;
  }
  next();
};
