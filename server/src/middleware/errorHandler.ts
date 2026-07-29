import { NextFunction, Request, Response } from "express";
import { HttpError } from "./auth";
import { ZodError } from "zod";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Datos invalidos", detalles: err.flatten() });
    return;
  }
  if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
    res.status(409).json({ error: "Ya existe un registro con esos datos (violacion de unicidad)" });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}

// Envuelve handlers async para que sus rechazos lleguen al errorHandler.
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  fn: T
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
