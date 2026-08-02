import "dotenv/config";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./env";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

import { authRouter } from "./modules/auth/auth.routes";
import { obrasRouter } from "./modules/obras/obras.routes";
import { personasRouter } from "./modules/personas/personas.routes";
import { asistenciasRouter } from "./modules/asistencias/asistencias.routes";
import { avancesRouter } from "./modules/avances/avances.routes";
import { evidenciasRouter } from "./modules/evidencias/evidencias.routes";
import { partidasRouter } from "./modules/partidas/partidas.routes";
import { transaccionesRouter } from "./modules/transacciones/transacciones.routes";
import { remisionesRouter } from "./modules/remisiones/remisiones.routes";
import { materialesRouter } from "./modules/materiales/materiales.routes";
import { herramientasRouter } from "./modules/herramientas/herramientas.routes";
import { reportesRouter } from "./modules/reportes/reportes.routes";
import { notificacionesRouter } from "./modules/notificaciones/notificaciones.routes";
import { historialRouter } from "./modules/historial/historial.routes";
import { usuariosRouter } from "./modules/usuarios/usuarios.routes";
import { empresaRouter } from "./modules/empresa/empresa.routes";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "5mb" }));

// Evidencias servidas como estaticos locales (ver middleware/upload.ts).
app.use("/uploads", express.static(env.uploadDir));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "bitacora-api" }));

app.use("/api/auth", authRouter);
app.use("/api/obras", obrasRouter);
app.use("/api/personas", personasRouter);
app.use("/api/materiales", materialesRouter);
app.use("/api/herramientas", herramientasRouter);
app.use("/api/evidencias", evidenciasRouter);
app.use("/api/reportes", reportesRouter);
app.use("/api/notificaciones", notificacionesRouter);
app.use("/api/mi-historial", historialRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/empresa", empresaRouter);

// Rutas anidadas por obra (modulo modular: cada dominio vive en su propio
// router, montado bajo /obras/:obraId/<dominio>, seccion 03).
app.use("/api/obras/:obraId/asistencias", asistenciasRouter);
app.use("/api/obras/:obraId/avances", avancesRouter);
app.use("/api/obras/:obraId/partidas", partidasRouter);
app.use("/api/obras/:obraId/transacciones", transaccionesRouter);
app.use("/api/obras/:obraId/remisiones", remisionesRouter);

// Build estatico del frontend (web/dist), copiado a /app/web-dist en la
// imagen de produccion. En desarrollo esta carpeta no existe: Vite sirve
// el frontend en su propio puerto (5173) via proxy, asi que se omite.
const webDistDir = path.resolve(__dirname, "../web-dist");
if (fs.existsSync(webDistDir)) {
  app.use(express.static(webDistDir));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
    res.sendFile(path.join(webDistDir, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`OBRA/OS API escuchando en http://localhost:${env.port}`);
});
