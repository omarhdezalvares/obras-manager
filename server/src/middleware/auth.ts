import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { RoleName } from "../lib/roles";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new HttpError(401, "Falta el token de acceso");
  }
  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw new HttpError(401, "Token invalido o expirado");
  }
}

// Verifica que el rol del usuario autenticado este en la lista permitida
// para el modulo/accion, siguiendo la matriz de la seccion 06.
export function requireRole(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new HttpError(401, "No autenticado");
    if (!roles.includes(req.user.rol as RoleName)) {
      throw new HttpError(403, `Rol '${req.user.rol}' no autorizado para esta accion`);
    }
    next();
  };
}
