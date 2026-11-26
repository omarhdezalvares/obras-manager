# Cobro con Stripe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prueba de 14 días, contratación con tarjeta o SPEI vía Stripe, límites por plan, gracia de 7 días y solo lectura, todo decidido por `Tenant.vigenteHasta`.

**Architecture:** Una función pura calcula el estado de la empresa a partir de `plan`, `vigenteHasta` y `activo`; un middleware global la aplica en cada petición autenticada. Un módulo `facturacion` habla con Stripe (Checkout, suscripción `send_invoice`, Portal) y un webhook firmado es el único que mueve `plan`/`vigenteHasta` desde Stripe. La web lee el estado de `/api/empresa` para la franja de avisos y la pantalla "Plan y pago".

**Tech Stack:** Express + Prisma (Postgres) + zod; SDK `stripe` (nuevo); React + Tailwind; pruebas `node:test` con `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-cobro-stripe-design.md`

## Global Constraints

- Única dependencia nueva: `stripe` en `server/`.
- Planes y límites: `trial` 3 obras / 10 usuarios; `basico` 3 / 10; `profesional` 10 / 30; `empresa` y `piloto` sin límite.
- Precios en Stripe sin IVA + Tax Rate exclusivo "IVA 16%" (`default_tax_rates`).
- Gracia: 7 días después de `vigenteHasta`. Prueba: 14 días desde el registro.
- Usuarios que cuentan: `Usuario` con `activo = true` y `deletedAt = null`. Obras activas: `estado` distinto de `cerrada` y `cancelada` (y `deletedAt = null` si el modelo lo tiene).
- Solo `invoice.paid` (y el super admin, proyecto siguiente) escribe `plan` y `vigenteHasta`.
- Variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASICO`, `STRIPE_PRICE_PROFESIONAL`, `STRIPE_PRICE_EMPRESA`, `STRIPE_TAX_RATE_IVA`. Sin ellas el server arranca y `/api/facturacion/*` (salvo `GET /estado`) responde 503 "Cobro no configurado".
- Pruebas con BD: `usarSchemaDeTest("test_<nombre>")` + `prisma db push --force-reset` como `server/src/middleware/rateLimit.test.ts`. Comando de suite: `cd server && npm test`.
- Rama `saas/stripe` desde `dev`; un commit por tarea; merge y push solo a `dev`.

## Review Focus

1. Eventos de Stripe repetidos o en desorden (`invoice.paid` antes de `checkout.session.completed`): el tenant se resuelve por `metadata.tenantId` de la suscripción, y reprocesar no cambia nada.
2. Empresa que bajó de plan con más obras/usuarios que el nuevo límite: lo existente sigue editable; solo se bloquea crear o reactivar.
3. Administrador de una empresa en solo lectura: puede abrir "Plan y pago", pagar y exportar reportes; nada más escribe.
4. Fronteras de fecha: exactamente en `vigenteHasta` es activo; exactamente en `vigenteHasta + 7 d` es gracia; un milisegundo después, solo lectura.
5. Entorno sin Stripe (local, tests, preview sin llaves): todo funciona y "Plan y pago" dice "Cobro no configurado".

---

### Task 1: Campos de vigencia y regla de estado

**Files:**
- Modify: `server/prisma/schema.prisma` (model `Tenant`)
- Create: `server/prisma/migrations/20261125120000_vigencia_plan/migration.sql`
- Create: `server/src/lib/plan.ts`, Test: `server/src/lib/plan.test.ts`
- Modify: `server/src/lib/empresa.ts:21` (registro)

**Interfaces:**
- Produces: `type Plan = "trial" | "basico" | "profesional" | "empresa" | "piloto"`; `type EstadoCuenta = "prueba" | "activa" | "gracia" | "solo_lectura" | "suspendida"`; `const DIAS_PRUEBA = 14`, `const DIAS_GRACIA = 7`; `limitesDe(plan: string): { obras: number; usuarios: number }` (sin límite = `Infinity`; plan desconocido = límites de `trial`); `estadoCuenta(t: { plan: string; vigenteHasta: Date | null; activo: boolean }, ahora?: Date): EstadoCuenta`; `finDeGracia(vigenteHasta: Date): Date`.

- [ ] **Step 1: Write the failing test** `plan.test.ts` (sin BD):
  - `estadoCuenta({plan:"piloto", vigenteHasta:null, activo:true})` → `"activa"`.
  - `activo:false` gana sobre todo → `"suspendida"` (incluso piloto).
  - Con `v = 2026-12-01T00:00Z`: `trial` en `v` → `"prueba"`; `basico` en `v` → `"activa"`; en `v + 7 d` → `"gracia"`; en `v + 7 d + 1 ms` → `"solo_lectura"` (Review Focus 4).
  - `vigenteHasta:null` con plan ≠ piloto → `"solo_lectura"`.
  - `limitesDe("profesional")` → `{obras:10, usuarios:30}`; `limitesDe("empresa").obras === Infinity`; `limitesDe("raro")` → `{obras:3, usuarios:10}`.
- [ ] **Step 2:** `cd server && npx tsx --test src/lib/plan.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar `plan.ts`. Schema: `vigenteHasta DateTime?`, `stripeCustomerId String? @unique`, `stripeSubscriptionId String? @unique`, `metodoPago String?`, `origenPago String?`. Migración SQL: `ALTER TABLE` + `UPDATE "Tenant" SET "vigenteHasta" = "createdAt" + interval '14 days' WHERE plan = 'trial';`. Registro: `vigenteHasta: new Date(Date.now() + DIAS_PRUEBA * 86_400_000)`.
- [ ] **Step 4:** Mismo comando → PASS; `npx prisma validate` → OK; `npm test` → todo verde.
- [ ] **Step 5:** Commit `feat(cobro): vigencia de la empresa y regla de estado`.

### Task 2: Middleware de estado de cuenta

**Files:**
- Create: `server/src/middleware/estadoCuenta.ts`, Test: `server/src/middleware/estadoCuenta.test.ts`
- Modify: `server/src/app.ts` (montarlo justo después de `express.json`, antes de los routers)

**Interfaces:**
- Consumes: `estadoCuenta` (Task 1), `verifyAccessToken` (`lib/jwt.ts`).
- Produces: `aplicarEstadoCuenta(req, res, next): Promise<void>` — sin header Bearer válido → `next()` (los routers ya responden 401). Con token: carga `tenant` (`plan, vigenteHasta, activo`); `suspendida` → 403 "El tenant de esta cuenta esta suspendido"; `solo_lectura` y método ∉ {GET, HEAD, OPTIONS} y ruta no exenta → 402 `{ error: "Tu cuenta está en solo lectura. Contrata un plan para seguir capturando.", estado: "solo_lectura" }`. Exentas: `/api/auth/*`, `/api/facturacion/*`, `POST /api/reportes/:tipo/exportar`. (Marcar notificaciones no tiene ruta de escritura hoy, no requiere excepción.)

- [ ] **Step 1: Write the failing test** (BD `test_estado_cuenta`, app real, usuario creado con `crearEmpresa` + login):
  - tenant con `vigenteHasta` hace 10 días: `POST /api/obras` → 402 con `estado:"solo_lectura"`; `GET /api/obras` → 200; `POST /api/reportes/<tipo>/exportar` → no 402 (Review Focus 3).
  - `vigenteHasta` hace 3 días (gracia): `POST /api/obras` → no 402.
  - `activo=false`: `GET /api/obras` con token vigente → 403.
- [ ] **Step 2:** `cd server && npx tsx --test src/middleware/estadoCuenta.test.ts` → FAIL.
- [ ] **Step 3:** Implementar y montar.
- [ ] **Step 4:** Mismo comando → PASS; `npm test` → verde (incluye `aislamiento.test.ts`).
- [ ] **Step 5:** Commit `feat(cobro): solo lectura y suspensión en cada petición`.

### Task 3: Límites por plan

**Files:**
- Create: `server/src/lib/limites.ts`, Test: `server/src/lib/limites.test.ts`
- Modify: `server/src/modules/obras/obras.routes.ts` (POST `/` ~l.99, PATCH `/:id` ~l.207), `server/src/modules/usuarios/usuarios.routes.ts` (POST `/` ~l.94, PATCH `/:id` ~l.127)

**Interfaces:**
- Consumes: `limitesDe` (Task 1).
- Produces: `assertCabeObra(tenantId: string): Promise<void>` y `assertCabeUsuario(tenantId: string): Promise<void>` — lanzan `HttpError(403, "Tu plan permite N obras activas. Sube de plan para agregar más.")` / `"Tu plan permite N usuarios. Sube de plan para agregar más."`; `uso(tenantId: string): Promise<{ obras: number; usuarios: number }>` (para Task 6).

- [ ] **Step 1: Write the failing test** (BD `test_limites`, plan `basico`):
  - con 3 obras planeada/en_ejecucion/pausada: crear la 4ª → 403 con "3 obras activas"; con una de ellas `cerrada`, crear → 201.
  - PATCH de obra `cerrada` → `en_ejecucion` estando en el límite → 403; PATCH de nombre de una obra existente estando en 5/3 → 200 (Review Focus 2).
  - 10 usuarios activos: crear el 11º → 403; reactivar (`activo:true`) uno inactivo → 403; un `Usuario` inactivo no cuenta.
  - plan `empresa`: crear sin límite → 201.
- [ ] **Step 2:** `npx tsx --test src/lib/limites.test.ts` → FAIL.
- [ ] **Step 3:** Implementar; llamar `assertCabe*` solo al crear y al pasar de no-contado a contado.
- [ ] **Step 4:** PASS; `npm test` → verde.
- [ ] **Step 5:** Commit `feat(cobro): límites de obras y usuarios por plan`.

### Task 4: Módulo de facturación (Stripe)

**Files:**
- Modify: `server/package.json` (`npm i stripe --prefix server`), `server/src/env.ts`
- Create: `server/src/lib/stripe.ts`, `server/src/modules/facturacion/facturacion.routes.ts`, Test: `server/src/modules/facturacion/facturacion.test.ts`
- Modify: `server/src/app.ts` (montar `/api/facturacion`)

**Interfaces:**
- Consumes: `estadoCuenta`, `limitesDe` (Task 1), `uso` (Task 3).
- Produces:
  - `env.stripe: { secretKey, webhookSecret, precios: { basico, profesional, empresa }, ivaTaxRate } | null` (null si falta alguna).
  - `planDePrecio(priceId: string): Plan | null`.
  - `paramsSuscripcion(t: { id: string; vigenteHasta: Date | null }, plan: Plan, ahora: Date): { items; default_tax_rates; metadata: { tenantId }; trial_end?: number }` — `trial_end` = `vigenteHasta` en segundos solo si `vigenteHasta > ahora + 48 h` (Stripe exige margen), si no, se omite.
  - Rutas (todas `requireAuth`; las de escritura `requireRole("Administrador")`):
    - `GET /estado` → `{ plan, estado, vigenteHasta, finGracia, metodoPago, limites, uso, cobroConfigurado, primerCobro? }`.
    - `POST /checkout { plan }` → `{ url }` (Checkout `mode=subscription`, `client_reference_id`, `subscription_data: paramsSuscripcion(...)`, `success_url`/`cancel_url` = `${env.appUrl}/plan?pago=ok|cancelado`, customer existente o `customer_email` del admin).
    - `POST /transferencia { plan }` → `{ facturaUrl | null }` (crea Customer si falta con `metadata.tenantId`; suscripción `collection_method=send_invoice`, `days_until_due=5`, `payment_settings.payment_method_types=["customer_balance"]`, más `paramsSuscripcion`). Guarda `stripeCustomerId`, `stripeSubscriptionId`, `metodoPago="transferencia"`.
    - `POST /cambiar-plan { plan }` → subir: `proration_behavior="always_invoice"`; bajar: `proration_behavior="none"` con cambio al fin del periodo (subscription schedule o `billing_cycle_anchor` sin cambiar; elegir el que la API soporte con send_invoice) → `{ ok: true }`.
    - `POST /portal` → `{ url }` (Customer Portal, `return_url = ${env.appUrl}/plan`).
  - Sin `env.stripe`: todas salvo `GET /estado` → 503 "Cobro no configurado".

- [ ] **Step 1: Write the failing test** (sin red):
  - `paramsSuscripcion` con `vigenteHasta = ahora + 10 d` → `trial_end` = esos segundos; con `ahora + 1 d` → sin `trial_end`; `metadata.tenantId` presente; `default_tax_rates` = `[ivaTaxRate]`.
  - `planDePrecio` mapea los tres IDs y devuelve `null` para otro.
  - App sin variables de Stripe: `POST /api/facturacion/checkout` → 503; `GET /api/facturacion/estado` → 200 con `cobroConfigurado:false` y `uso` (Review Focus 5); usuario no Administrador → 403 en `POST /checkout`.
- [ ] **Step 2:** `npx tsx --test src/modules/facturacion/facturacion.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS; `npm test` → verde; `npm run build` en server → OK.
- [ ] **Step 5:** Commit `feat(cobro): contratar con tarjeta o transferencia y portal de Stripe`.

### Task 5: Webhook de Stripe

**Files:**
- Create: `server/src/modules/facturacion/webhook.ts`, Test: `server/src/modules/facturacion/webhook.test.ts`
- Modify: `server/src/app.ts` (`app.post("/api/facturacion/webhook", express.raw({ type: "application/json" }), stripeWebhook)` **antes** de `express.json`)

**Interfaces:**
- Consumes: `planDePrecio`, `env.stripe` (Task 4), `writeAuditLog`.
- Produces: `aplicarEvento(evento: Stripe.Event): Promise<void>`; handler `stripeWebhook` (verifica con `stripe.webhooks.constructEvent`; firma inválida → 400; sin `env.stripe` → 503).
  - Tenant: `metadata.tenantId` de la suscripción (en `invoice.parent.subscription_details.metadata` o `subscription_details.metadata`, según la versión de API) → si no, por `stripeCustomerId`. Desconocido → ignorar, 200.
  - `checkout.session.completed` → guarda customer/subscription y `metodoPago="tarjeta"`.
  - `invoice.paid` → `vigenteHasta = max(actual, fin del periodo de la línea de suscripción)`, `plan = planDePrecio(price)`, `origenPago="stripe"`, guarda IDs; auditoría `entidadTipo:"Tenant"`.
  - `customer.subscription.deleted` → `stripeSubscriptionId = null` (no toca fecha).
  - `customer.subscription.updated` → solo IDs.

- [ ] **Step 1: Write the failing test** (BD `test_webhook`; eventos JSON armados a mano, firmados con `stripe.webhooks.generateTestHeaderString` y un secreto de prueba fijo):
  - `invoice.paid` profesional con periodo hasta `2027-01-15` → tenant `plan:"profesional"`, `vigenteHasta` = esa fecha, `origenPago:"stripe"`.
  - el mismo evento dos veces → mismo resultado; `invoice.paid` llegando antes que `checkout.session.completed` → igual liga el tenant por metadata (Review Focus 1).
  - un `invoice.paid` con periodo anterior al actual no retrocede la fecha.
  - firma alterada → 400; cliente desconocido → 200 sin cambios.
  - `customer.subscription.deleted` → `stripeSubscriptionId` null y `vigenteHasta` intacta.
- [ ] **Step 2:** `npx tsx --test src/modules/facturacion/webhook.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS; `npm test` → verde.
- [ ] **Step 5:** Commit `feat(cobro): webhook de Stripe mueve plan y vigencia`.

### Task 6: Web — franja de avisos y "Plan y pago"

**Files:**
- Create: `web/src/pages/Plan.tsx`, `web/src/components/AvisoCuenta.tsx`, `web/src/lib/cuenta.ts`, Test: `web/src/lib/cuenta.test.ts`
- Modify: `web/src/App.tsx` (ruta `/plan`, visible a todos; acciones solo Administrador), `web/src/components/Layout.tsx` (franja arriba + "Plan y pago" en el menú de Administrador junto a "Empresa")

**Interfaces:**
- Consumes: `GET/POST /api/facturacion/*` (Task 4).
- Produces: `mensajeCuenta(e: { estado: string; vigenteHasta: string | null; finGracia: string | null }, hoy: Date): string | null` en `cuenta.ts`:
  - `prueba` con ≤ 5 días → "Te quedan N días de prueba." (N redondeado hacia arriba; 1 → "Te queda 1 día de prueba.").
  - `gracia` → "Tu pago está pendiente. El DD/MM tu cuenta pasa a solo lectura."
  - `solo_lectura` → "Tu cuenta está en solo lectura. Contrata un plan para seguir capturando."
  - otro caso → `null`.

- [ ] **Step 1: Write the failing test** `cuenta.test.ts` con los cuatro casos y las fronteras de 5 días y de 1 día.
- [ ] **Step 2:** `cd server && npx tsx --test ../web/src/lib/cuenta.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `cuenta.ts`, `AvisoCuenta` (usa react-query sobre `/facturacion/estado`, enlace "Plan y pago" para Administrador) y `Plan.tsx`: plan actual, estado, vigente hasta / primer cobro, barras de uso contra límites (reutilizar `BarraPresupuesto` o similar), tres planes con precio + IVA, selector Tarjeta/Transferencia y botón "Contratar"; con suscripción: "Administrar pago" (Portal) y, si `metodoPago="transferencia"`, "Cambiar plan". `cobroConfigurado:false` → "Cobro no configurado". `?pago=ok` → aviso "Recibimos tu pago; tu plan se actualiza en unos segundos."
- [ ] **Step 4:** PASS; `cd web && npm run build` → OK; captura con Playwright de `/plan` como Administrador demo en local (sin Stripe: "Cobro no configurado") y de la franja forzando `vigenteHasta` vencida en el schema `dev`.
- [ ] **Step 5:** Commit `feat(cobro): pantalla Plan y pago y avisos de cuenta`.

### Task 7: Configuración de Stripe e integración

**Files:**
- Create: `server/scripts/stripe-setup.ts`
- Modify: `docs/SAAS-CHECKLIST.md`

- [ ] **Step 1:** `stripe-setup.ts` (idempotente, busca por `lookup_key`): crea en la cuenta de las llaves actuales los productos Básico/Profesional/Empresa con Price mensual MXN 129000 / 269000 / 549000 centavos (`lookup_key` `bitacora_basico` etc.), el Tax Rate "IVA 16%" exclusivo `jurisdiction: "MX"`, y el endpoint de webhook en `${APP_URL}/api/facturacion/webhook` con los 4 eventos (en preview, que tiene Vercel Authentication, la URL lleva `?x-vercel-protection-bypass=<secreto de automatización>` leído de una variable, nunca impreso); imprime solo los IDs (nunca llaves).
- [ ] **Step 2:** Con llaves de prueba en `server/.env` (Omar): correr el script, poner IDs en `.env` y en Vercel Preview; configurar el Customer Portal (cambiar plan entre los 3 precios, bajadas al fin del periodo, cancelar al fin del periodo).
- [ ] **Step 3:** Prueba manual en preview con tarjeta `4242 4242 4242 4242`: contratar Profesional en prueba → franja sin aviso, "primer cobro" = fin de prueba; adelantar con Test Clock o `invoice.paid` reenviado desde el dashboard → `plan:"profesional"`.
- [ ] **Step 4:** Checklist: marcar Stripe/límites/trial con fecha y rama; pendientes: activar cuenta real, variables de Production.
- [ ] **Step 5:** `npm test` (server) + `npm run build` (web) verdes → merge `saas/stripe` a `dev`, push a `dev`.
