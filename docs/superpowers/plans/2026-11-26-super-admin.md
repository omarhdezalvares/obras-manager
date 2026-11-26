# Panel de super admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel `/admin` para los dueños de Bitácora: tablero de clientes, ficha con acciones manuales y tendencias por giro/canal, más las dos preguntas nuevas del registro.

**Architecture:** Router `server/src/modules/admin/` protegido por `requireSuperAdmin` (correo leído de la base contra `SUPERADMIN_EMAILS`, 404 si no). Cálculos de tablero y tendencias como funciones puras en `admin/resumen.ts`, probadas sin HTTP. Web: tres páginas bajo `web/src/pages/admin/`, menú visible con `superAdmin` de `/auth/me`.

**Tech Stack:** Express + Prisma + zod, React + react-query + Tailwind, `node:test` vía `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-26-super-admin-design.md`

## Global Constraints

- Giros (orden exacto): Obra civil, Instalaciones eléctricas, Voz y datos, CCTV y seguridad, Aire acondicionado, Plomería, Mantenimiento, Servicios en campo, Otro.
- Canales (orden exacto): Facebook / Instagram, Google, Recomendación, WhatsApp, Evento o expo, Otro (con texto).
- Precios de lista mensuales: basico 1290, profesional 2690, empresa 5490 (MXN, + IVA).
- "Compró" = `Tenant.primerPagoAt` no nulo (factura Stripe con `amount_paid > 0` o pago manual).
- Sin acceso → 404 en `/api/admin/*`. El correo se lee de la base, nunca del token.
- Empresas internas (con usuario en `SUPERADMIN_EMAILS`) fuera de tablero y tendencias; no se suspenden desde el panel.
- Cada acción escribe `AuditLog` con `usuarioId` del super admin y `tenantId` de la empresa afectada.
- Aviso Stripe exacto: "Esta empresa paga con Stripe; el cambio se revierte en su próximo cobro."
- Migración aditiva, columnas nulas. Archivos CRLF.

## Review Focus

1. `SUPERADMIN_EMAILS` vacía o ausente: nadie es super admin (no "todos").
2. Correo con mayúsculas o espacios en la lista o en la base: compara normalizado (trim + minúsculas).
3. Pago manual con fecha pasada o inválida: 400 (una fecha pasada dejaría la empresa en solo lectura sin querer).
4. Canal "Otro" sin texto: 400 en registro; canal distinto de "Otro" con texto: se guarda `canalDetalle = null`.
5. Factura pagada por segunda vez: `primerPagoAt` no cambia.

---

### Task 1: Datos nuevos y registro con giro y canal

**Files:**
- Modify: `server/prisma/schema.prisma` (Tenant: `giro String?`, `canal String?`, `canalDetalle String?`, `primerPagoAt DateTime?`; RegistroPendiente: `giro String?`, `canal String?`, `canalDetalle String?`)
- Create: `server/prisma/migrations/20261126120000_marketing_tenant/migration.sql`
- Create: `server/src/lib/marketing.ts`
- Modify: `server/src/lib/empresa.ts`, `server/src/modules/auth/auth.routes.ts` (registroSchema)
- Test: `server/src/lib/marketing.test.ts`, `server/src/modules/auth/registro.test.ts` (o el test de auth existente si ya cubre `/registro`)

**Interfaces:**
- Produces: `GIROS: readonly string[]`, `CANALES: readonly string[]` y `marketingSchema` (zod: `giro` enum GIROS, `canal` enum CANALES, `canalDetalle` string opcional ≤120; refine: canal "Otro" exige canalDetalle no vacío; transform: canalDetalle = null si canal ≠ "Otro") en `lib/marketing.ts`.
- `crearEmpresa(datos: { empresa; email; passwordHash; giro?: string|null; canal?: string|null; canalDetalle?: string|null })`; `solicitarRegistro` recibe y guarda los tres campos; `confirmarRegistro` los pasa.

- [ ] **Step 1: Tests** — `marketingSchema`: acepta `{giro:"Plomería", canal:"Google"}`; rechaza `canal:"Otro"` sin detalle; `{canal:"Google", canalDetalle:"x"}` → `canalDetalle === null`; rechaza giro fuera de lista. Registro HTTP: `POST /api/auth/registro` sin giro → 400; con datos válidos → 202 y la fila `RegistroPendiente` tiene giro/canal; `confirmarRegistro` crea Tenant con giro/canal.
- [ ] **Step 2: Run** `cd server && npx tsx --test src/lib/marketing.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3: Implement** schema + migración SQL (ALTER TABLE ADD COLUMN, nulos) + `lib/marketing.ts` + registro (`registroSchema = base.and(marketingSchema)` o `.merge`).
- [ ] **Step 4: Run** tests del paso 1 y `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(registro): giro y canal de la empresa`

### Task 2: primerPagoAt desde el webhook

**Files:** Modify `server/src/modules/facturacion/webhook.ts`; Test `webhook.test.ts`

**Interfaces:** Produces: `Tenant.primerPagoAt` se fija en `invoice.paid` si `f.amount_paid > 0` y está vacío.

- [ ] **Step 1: Tests** — factura con `amount_paid: 0` → `primerPagoAt` null; con `amount_paid: 149640` → fecha del evento (`new Date(evento.created*1000)`); segunda factura pagada no cambia la fecha. (Añadir `amount_paid` y `created` a `facturaPagada`.)
- [ ] **Step 2: Run** `npx tsx --test src/modules/facturacion/webhook.test.ts` → FAIL.
- [ ] **Step 3: Implement** en el `update` de `invoice.paid`: `...(f.amount_paid > 0 && !antes.primerPagoAt ? { primerPagoAt: new Date(evento.created * 1000) } : {})`.
- [ ] **Step 4: Run** → PASS; `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(cobro): fecha del primer pago real`

### Task 3: Acceso de super admin y tablero

**Files:**
- Modify: `server/src/env.ts` (`superAdminEmails: string[]` de `SUPERADMIN_EMAILS`, trim + minúsculas, vacíos fuera)
- Create: `server/src/middleware/superAdmin.ts`, `server/src/modules/admin/admin.routes.ts`, `server/src/modules/admin/resumen.ts`
- Modify: `server/src/app.ts` (`app.use("/api/admin", adminRouter)`), `auth.routes.ts` `/me` (`superAdmin: boolean`)
- Test: `server/src/modules/admin/admin.test.ts`, `server/src/modules/admin/resumen.test.ts`

**Interfaces:**
- `esSuperAdmin(email: string): boolean` y `requireSuperAdmin` (tras `requireAuth`; busca `usuario.email` por `req.user.sub`; no está → `HttpError(404, "No encontrado")`) en `middleware/superAdmin.ts`.
- `tenantsInternos(): Promise<string[]>` (ids de tenants con usuario cuyo correo está en la lista) en `resumen.ts`.
- `PRECIO_LISTA: Record<"basico"|"profesional"|"empresa", number>`; `resumenTablero(filas: FilaEmpresa[], ahora?: Date): { contadores: Record<"pagando"|"prueba"|"gracia"|"solo_lectura"|"suspendida"|"piloto", number>; ingresoMensualEstimado: number }` donde `FilaEmpresa = { plan; activo; vigenteHasta: Date|null }`. "pagando" = estado `activa` con plan pagado; ingreso = suma `PRECIO_LISTA` de estados `activa`/`gracia` con plan pagado.
- `GET /api/admin/empresas` → `{ contadores, ingresoMensualEstimado, empresas: { id, nombre, giro, canal, plan, estado, vigenteHasta, metodoPago, ultimoAcceso, adminEmail }[] }` (sin internas; `ultimoAcceso` = max `ultimoLoginAt` de sus usuarios; `adminEmail` = Administrador activo más antiguo). Filtros y búsqueda en la web.

- [ ] **Step 1: Tests** — `resumen.test.ts`: con filas [profesional activa, basico gracia, trial prueba, basico vencido > 7 días, activo=false, piloto] → contadores 1/1/1/1/1/1 e ingreso 2690+1290. `admin.test.ts` (schema `test_admin`, `SUPERADMIN_EMAILS=" Jefe@Bitacora.test "` antes de importar app): admin normal → 404 en `/api/admin/empresas`; usuario `jefe@bitacora.test` → 200 y su propia empresa no aparece; `/api/auth/me` devuelve `superAdmin` true/false; con `SUPERADMIN_EMAILS` vacía `esSuperAdmin("")` y `esSuperAdmin("x@y")` → false.
- [ ] **Step 2: Run** `npx tsx --test src/modules/admin/*.test.ts` → FAIL.
- [ ] **Step 3: Implement** según Interfaces.
- [ ] **Step 4: Run** → PASS; `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(admin): acceso de super admin y tablero de clientes`

### Task 4: Ficha y acciones manuales

**Files:** Modify `admin.routes.ts`; Test `admin.test.ts`

**Interfaces (todas 404 si la empresa no existe o es interna):**
- `GET /api/admin/empresas/:id` → datos + `uso` (de `lib/limites.uso`) + `limites` (null = sin límite) + `tieneSuscripcion` + `historial` (AuditLog `entidadTipo:"Tenant"` de esa empresa, más reciente primero, con `quien`: correo del usuario o "stripe").
- `POST /api/admin/empresas/:id/pago-manual` body `{ plan: "basico"|"profesional"|"empresa"|"piloto", hasta: "YYYY-MM-DD", monto?: number ≥ 0, nota?: string ≤ 300 }`; `hasta` debe ser futura (400 si no). Fija plan, `vigenteHasta` (fin del día UTC de `hasta`), `origenPago:"manual"`, `metodoPago:"manual"`, `primerPagoAt` si vacío. AuditLog `accion:"pago_manual"` con antes/después, monto, nota. Responde `{ ok: true, aviso: string|null }` (aviso Stripe si `stripeSubscriptionId`).
- `PATCH /api/admin/empresas/:id/plan` `{ plan }` → solo plan; AuditLog `accion:"cambiar_plan"`; misma respuesta con aviso.
- `PATCH /api/admin/empresas/:id/activo` `{ activo: boolean }` → AuditLog `accion: activo ? "reactivar" : "suspender"`.
- `PATCH /api/admin/empresas/:id/marketing` `{ giro?, canal?, canalDetalle? }` validado con las listas de `lib/marketing.ts` (parcial) → AuditLog `accion:"actualizar"`.

- [ ] **Step 1: Tests** — pago manual: deja plan `profesional`, estado `activa`, `origenPago` manual, `primerPagoAt` fijado, AuditLog con `usuarioId` del super admin; `hasta` de ayer → 400; empresa con `stripeSubscriptionId` → `aviso` igual al texto exacto; suspender empresa interna → 404; suspender cliente → `activo=false` y su admin recibe 403 en `GET /api/obras`; marketing con canal "Otro" sin detalle → 400; admin normal → 404 en cada ruta.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(admin): ficha de empresa y acciones manuales`

### Task 5: Tendencias

**Files:** Modify `resumen.ts`, `admin.routes.ts`; Test `resumen.test.ts`, `admin.test.ts`

**Interfaces:**
- `tendencias(filas: { giro: string|null; canal: string|null; plan: string; primerPagoAt: Date|null }[]): { porGiro: Fila[]; porCanal: Fila[]; planes: Record<"basico"|"profesional"|"empresa", number> }`, `Fila = { clave: string; registros: number; compraron: number; conversion: number }` (conversion entero 0–100, redondeado; null → clave "Sin dato"; ordenado por registros desc). `planes` cuenta el plan actual de las que compraron.
- `GET /api/admin/tendencias?periodo=30d|90d|12m|todo` (default 90d) filtra por `createdAt` y excluye internas.

- [ ] **Step 1: Tests** — 3 filas Plomería (1 compró, profesional), 1 sin giro → porGiro `[{Plomería,3,1,33},{Sin dato,1,0,0}]`, planes `{basico:0,profesional:1,empresa:0}`; HTTP `periodo=30d` excluye una empresa con `createdAt` de hace 60 días; `periodo=xx` → 400.
- [ ] **Step 2–4:** FAIL → implementar → PASS + `npm test`.
- [ ] **Step 5: Commit** `feat(admin): tendencias por giro, canal y plan`

### Task 6: Script de alta de super admin

**Files:** Create `server/scripts/crear-superadmin.ts`

**Interfaces:** `npx tsx scripts/crear-superadmin.ts --email <correo>`; contraseña de `SUPERADMIN_PASSWORD` (falta → error, nunca se imprime); si el correo ya existe, no hace nada y lo dice; si no existe empresa interna (tenant con slug que empiece por `bitacora-interna`), la crea con `crearEmpresa` y la pasa a plan `piloto`, `vigenteHasta: null`; si existe, agrega el usuario como Administrador de esa empresa. Avisa si el correo no está en `SUPERADMIN_EMAILS`.

- [ ] **Step 1:** Implementar; correr contra schema `dev` local con `SUPERADMIN_PASSWORD` de prueba; correrlo dos veces → la segunda dice "ya existe".
- [ ] **Step 2: Commit** `feat(admin): script para crear cuentas de super admin`

### Task 7: Web

**Files:**
- Modify: `web/src/pages/Acceso.tsx` (registro: dos `<select>` obligatorios + input "¿Cuál?" si canal Otro), `web/src/lib/auth.tsx` (`registrar` manda giro/canal/canalDetalle; `Usuario.superAdmin?: boolean`), `web/src/components/Layout.tsx` (entrada "Panel Bitácora" → `/admin` si `usuario.superAdmin`), `web/src/App.tsx` (rutas)
- Create: `web/src/lib/marketing.ts` (mismas listas que el server), `web/src/pages/admin/AdminEmpresas.tsx`, `AdminEmpresa.tsx`, `AdminTendencias.tsx`

**Interfaces:** Consume las rutas de Tasks 3–5. Rutas web `/admin`, `/admin/empresas/:id`, `/admin/tendencias`. Tablero: contadores, ingreso "estimado", filtros estado/plan/giro, búsqueda nombre/correo (en cliente). Ficha: formularios de las 4 acciones con confirmación en suspender; muestra `aviso` tras guardar y el aviso Stripe antes si `tieneSuscripcion`. Tendencias: selector de periodo y las tres tablas del mockup del spec.

- [ ] **Step 1:** Implementar con componentes de `components/ui`.
- [ ] **Step 2:** `cd web && npm run build` → OK; probar en local (`npm run dev`) con una cuenta creada por el script del Task 6 y `SUPERADMIN_EMAILS` en `server/.env`: tablero, ficha, pago manual, tendencias, registro con las preguntas.
- [ ] **Step 3: Commit** `feat(admin): panel web y preguntas del registro`

### Task 8: Checklist

- [ ] Actualizar `docs/SAAS-CHECKLIST.md` (super admin hecho en rama; pendiente: `SUPERADMIN_EMAILS` en Vercel y alta de cuentas en prod). Commit `docs: panel de super admin`.
