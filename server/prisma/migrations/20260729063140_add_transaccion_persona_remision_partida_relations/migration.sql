-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Remision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "folio" TEXT,
    "fecha" DATETIME NOT NULL,
    "costoTotal" REAL NOT NULL DEFAULT 0,
    "registradoPor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Remision_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Remision_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "PartidaPresupuestal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Remision" ("costoTotal", "createdAt", "deletedAt", "fecha", "folio", "id", "obraId", "partidaId", "proveedor", "registradoPor", "tenantId", "updatedAt") SELECT "costoTotal", "createdAt", "deletedAt", "fecha", "folio", "id", "obraId", "partidaId", "proveedor", "registradoPor", "tenantId", "updatedAt" FROM "Remision";
DROP TABLE "Remision";
ALTER TABLE "new_Remision" RENAME TO "Remision";
CREATE TABLE "new_Transaccion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "personaId" TEXT,
    "asistenciaId" TEXT,
    "remisionId" TEXT,
    "registradoPor" TEXT NOT NULL,
    "descripcion" TEXT,
    "motivoAjuste" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "Transaccion_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaccion_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "PartidaPresupuestal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaccion_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaccion_asistenciaId_fkey" FOREIGN KEY ("asistenciaId") REFERENCES "Asistencia" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaccion_remisionId_fkey" FOREIGN KEY ("remisionId") REFERENCES "Remision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaccion" ("asistenciaId", "createdAt", "descripcion", "id", "monto", "motivoAjuste", "obraId", "partidaId", "personaId", "registradoPor", "remisionId", "tenantId", "tipo", "updatedAt", "updatedBy") SELECT "asistenciaId", "createdAt", "descripcion", "id", "monto", "motivoAjuste", "obraId", "partidaId", "personaId", "registradoPor", "remisionId", "tenantId", "tipo", "updatedAt", "updatedBy" FROM "Transaccion";
DROP TABLE "Transaccion";
ALTER TABLE "new_Transaccion" RENAME TO "Transaccion";
CREATE UNIQUE INDEX "Transaccion_asistenciaId_key" ON "Transaccion"("asistenciaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
