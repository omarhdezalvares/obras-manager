import fs from "fs";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import { env } from "../env";

// Version de test: guarda evidencias en disco local en vez de S3. El
// documento pide URL prefirmada + bucket; aqui se simula con una ruta
// /uploads/<archivo> servida estatica, manteniendo el mismo modelo de datos
// (bucket/objectKey) para que la migracion a S3 sea solo de infraestructura.
if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${uuid()}${ext}`);
  },
});

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB, tope razonable para fotos de celular

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});
