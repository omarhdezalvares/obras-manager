-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'piloto',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Rol" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "nombre" TEXT NOT NULL,
    "permisos" TEXT,
    CONSTRAINT "Rol_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "personaId" TEXT,
    "ultimoLoginAt" DATETIME,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Usuario_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "telefono" TEXT,
    "puesto" TEXT,
    "tipoTrabajador" TEXT,
    "costoDiario" REAL NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Persona_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cliente" TEXT,
    "ubicacion" TEXT,
    "descripcion" TEXT,
    "observaciones" TEXT,
    "responsableId" TEXT,
    "fechaInicio" DATETIME,
    "fechaFinEstimada" DATETIME,
    "estado" TEXT NOT NULL DEFAULT 'planeada',
    "presupuestoAutorizado" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Obra_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Obra_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObraPersona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "rolEnObra" TEXT,
    "fechaAsignacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "costoDiarioObra" REAL,
    CONSTRAINT "ObraPersona_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ObraPersona_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "horaLlegada" TEXT NOT NULL,
    "registradoPor" TEXT NOT NULL,
    "geolocalizacion" TEXT,
    "observaciones" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asistencia_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asistencia_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Avance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "descripcion" TEXT NOT NULL,
    "registradoPor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Avance_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AvancePersona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "avanceId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "asistenciaId" TEXT NOT NULL,
    CONSTRAINT "AvancePersona_avanceId_fkey" FOREIGN KEY ("avanceId") REFERENCES "Avance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AvancePersona_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AvancePersona_asistenciaId_fkey" FOREIGN KEY ("asistenciaId") REFERENCES "Asistencia" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evidencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'local',
    "objectKey" TEXT NOT NULL,
    "tipoMime" TEXT,
    "tamanoBytes" INTEGER,
    "subidaPor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PartidaPresupuestal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT,
    "presupuestoInicial" REAL NOT NULL DEFAULT 0,
    "presupuestoActualizado" REAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PartidaPresupuestal_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaccion" (
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
    CONSTRAINT "Transaccion_asistenciaId_fkey" FOREIGN KEY ("asistenciaId") REFERENCES "Asistencia" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaccion_remisionId_fkey" FOREIGN KEY ("remisionId") REFERENCES "Remision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Remision" (
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
    CONSTRAINT "Remision_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemisionMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "remisionId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "costoUnitario" REAL NOT NULL,
    "costoTotal" REAL NOT NULL,
    CONSTRAINT "RemisionMaterial_remisionId_fkey" FOREIGN KEY ("remisionId") REFERENCES "Remision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RemisionMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT,
    "categoria" TEXT,
    CONSTRAINT "Material_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Herramienta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "marca" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'disponible',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Herramienta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HerramientaAsignacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "herramientaId" TEXT NOT NULL,
    "obraId" TEXT,
    "personaId" TEXT,
    "fechaAsignacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaDevolucion" DATETIME,
    "observaciones" TEXT,
    CONSTRAINT "HerramientaAsignacion_herramientaId_fkey" FOREIGN KEY ("herramientaId") REFERENCES "Herramienta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HerramientaAsignacion_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HerramientaAsignacion_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "cambios" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "obraId" TEXT,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_tenantId_nombre_key" ON "Rol"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_personaId_key" ON "Usuario"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_tenantId_email_key" ON "Usuario"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ObraPersona_obraId_personaId_key" ON "ObraPersona"("obraId", "personaId");

-- CreateIndex
CREATE UNIQUE INDEX "Asistencia_obraId_personaId_fecha_key" ON "Asistencia"("obraId", "personaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "AvancePersona_avanceId_personaId_key" ON "AvancePersona"("avanceId", "personaId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_asistenciaId_key" ON "Transaccion"("asistenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "Herramienta_tenantId_codigo_key" ON "Herramienta"("tenantId", "codigo");
