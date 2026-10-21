import fs from "fs";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import { env } from "../env";
import { HttpError } from "./auth";

// Version de test: guarda evidencias en disco local en vez de S3. El
// documento pide URL prefirmada + bucket; aqui se simula con una ruta
// /uploads/<archivo> servida estatica, manteniendo el mismo modelo de datos
// (bucket/objectKey) para que la migracion a S3 sea solo de infraestructura.
if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}

const EXTENSION_POR_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  // La extension sale del mimetype validado, nunca del nombre del cliente:
  // /uploads se sirve en el mismo origen y un "x.html" ejecutaria scripts.
  filename: (_req, file, cb) => {
    cb(null, `${uuid()}${EXTENSION_POR_MIME[file.mimetype] ?? ""}`);
  },
});

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB, tope razonable para fotos de celular

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      cb(new HttpError(400, `Tipo de archivo no permitido: ${file.mimetype}. Usa JPG, PNG, WEBP, HEIC o PDF`));
      return;
    }
    cb(null, true);
  },
});
