import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { estadoCuenta } from "../lib/plan";

const LECTURA = new Set(["GET", "HEAD", "OPTIONS"]);
// En solo lectura se puede pagar, iniciar sesion y descargar reportes.
const EXENTAS = [/^\/api\/auth\//, /^\/api\/facturacion\//, /^\/api\/reportes\/[^/]+\/exportar$/];

// Global y antes de los routers: sin token valido no hace nada (cada router ya responde 401).
export async function aplicarEstadoCuenta(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  let tenantId: string;
  try {
    tenantId = verifyAccessToken(header.slice("Bearer ".length)).tenantId;
  } catch {
    return next();
  }
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, vigenteHasta: true, activo: true } });
    if (!tenant) return next();
    const estado = estadoCuenta(tenant);
    if (estado === "suspendida") {
      res.status(403).json({ error: "El tenant de esta cuenta esta suspendido", estado });
      return;
    }
    if (estado === "solo_lectura" && !LECTURA.has(req.method) && !EXENTAS.some((r) => r.test(req.path))) {
      res.status(402).json({ error: "Tu cuenta está en solo lectura. Contrata un plan para seguir capturando.", estado });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
