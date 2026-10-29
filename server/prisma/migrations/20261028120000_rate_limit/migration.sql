-- CreateTable
CREATE TABLE "RateLimit" (
    "clave" TEXT NOT NULL PRIMARY KEY,
    "intentos" INTEGER NOT NULL,
    "reiniciaEn" DATETIME NOT NULL
);
