import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { HttpError } from "./auth";

// Cuenta un intento para `clave` y dice cuantos segundos faltan si ya se paso de `max`.
// shortcut: lectura + escritura no atomica, en rafagas simultaneas puede colar algun intento de mas; aceptable para frenar fuerza bruta.
// shortcut: las filas vencidas no se borran (se reutilizan al volver la misma clave); limpiar con un cron si la tabla crece.
export async function consumirIntento(clave: string, max: number, ventanaMs: number, ahora = new Date()): Promise<number | null> {
  const fila = await prisma.rateLimit.findUnique({ where: { clave } });
  if (!fila || fila.reiniciaEn <= ahora) {
    const reiniciaEn = new Date(ahora.getTime() + ventanaMs);
    await prisma.rateLimit.upsert({
      where: { clave },
      create: { clave, intentos: 1, reiniciaEn },
      update: { intentos: 1, reiniciaEn },
    });
    return null;
  }
  if (fila.intentos >= max) return Math.ceil((fila.reiniciaEn.getTime() - ahora.getTime()) / 1000);
  await prisma.rateLimit.update({ where: { clave }, data: { intentos: { increment: 1 } } });
  return null;
}

export function rateLimit(nombre: string, max: number, ventanaMs: number, clave: (req: Request) => string = (req) => req.ip ?? "?") {
  return (req: Request, res: Response, next: NextFunction): void => {
    consumirIntento(`${nombre}:${clave(req)}`, max, ventanaMs)
      .then((espera) => {
        if (espera === null) return next();
        res.setHeader("Retry-After", String(espera));
        next(new HttpError(429, "Demasiados intentos, espera unos minutos y vuelve a intentar"));
      })
      .catch(next);
  };
}
