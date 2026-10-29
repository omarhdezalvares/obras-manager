# Checklist para distribuir Bitácora como SaaS

> Seguimiento entre sesiones. Marca `[x]` al terminar un punto y anota la fecha/commit al lado.
> Antes de marcar algo, verifica en el código (no supongas). Creado: 2026-10-22.
>
> Orden sugerido: 🔴 Seguridad → 🔴 Infraestructura → 🔴 Onboarding → 🟠 Cobro → 🟡 → 🟢.

## 🔴 Bloqueantes (antes del primer cliente que paga)

### Seguridad y aislamiento entre clientes
- [x] `/uploads` es público (`server/src/index.ts`, `express.static`). Servir archivos con `requireAuth` y validar que la evidencia sea del tenant del usuario. (2026-10-22, `dd85713`: links firmados HMAC que caducan en 6–12 h, `server/src/lib/uploadUrl.ts`; solo los emiten rutas que ya validaron tenant/obra)
- [x] Secretos JWT tienen fallback de desarrollo (`server/src/env.ts`). Fallar al arrancar si faltan en producción. (2026-10-22, `dd85713`; en Vercel configurar `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`)
- [x] Login busca el email en todos los tenants (`auth.routes.ts`, `findFirst`) pero el email solo es único por tenant → si se repite entre empresas entra a la equivocada. Pedir tenant (slug/subdominio) o hacer el email único global. (2026-10-22, `dd85713`: email único global, migración `20261022120000_email_unico_global`)
- [x] Rate limiting en login, refresh y subida de archivos. (2026-10-28: contador en BD, tabla `RateLimit`, `server/src/middleware/rateLimit.ts`; login 10/15 min por IP+correo y 50 por IP, refresh 60/15 min, subidas 200/h por usuario; `trust proxy` activado)
- [x] Test automático de aislamiento: usuario del tenant A no puede leer/escribir datos del tenant B (cada módulo). (2026-10-28: `server/src/aislamiento.test.ts`; encontró y se corrigió `PATCH /api/personas/:id` sin filtro de tenant. Falta cubrir `POST /api/evidencias` multipart)

### Infraestructura (Vercel + Supabase)
- [ ] Proyectos Supabase separados: `bitacora-staging` y `bitacora-prod`.
- [ ] Migrar SQLite → Postgres de Supabase. Prisma: `DATABASE_URL` al pooler (puerto 6543, `?pgbouncer=true&connection_limit=1`) y `directUrl` (5432) para migraciones. Rehacer migraciones para `postgresql`.
- [ ] Archivos → Supabase Storage (bucket privado). Vercel limita el body a 4.5 MB y hoy se aceptan 15 MB por foto: subir directo del navegador con `createSignedUploadUrl` y el server solo registra la `Evidencia` (`bucket = "supabase"`). Lectura con URLs firmadas en lugar de `urlFirmada`. Quitar `multer` a disco y los `fs.unlink` (asistencias, empresa, evidencias).
- [ ] Adaptar Express a Vercel: exportar `app` desde una función (`api/index.ts`), `app.listen` solo en local, `web/` como build estático de Vite con rewrites de SPA y `/api/*` a la función.
- [ ] Verificar duración de función con reportes PDF/Excel/ZIP grandes (`pdfkit`, `exceljs` y `archiver` son JS puro, compatibles).
- [ ] Migrar los datos del piloto (Fly SQLite + `/data/uploads`) a Supabase.
- [ ] Backups: Supabase diario (plan Pro para PITR) + respaldo del bucket; restauración probada en staging.
- [ ] Previews de Vercel apuntando a Supabase staging, producción a prod.
- [ ] Apagar Fly cuando el piloto esté migrado (`fly.toml`, `Dockerfile`, `docker-entrypoint.sh`).

### Onboarding
- [ ] Registro self-service: crea tenant + admin + roles (hoy solo `seedProd.ts` a mano).
- [ ] Recuperar contraseña por correo.
- [ ] Invitación de usuarios por correo.
- [ ] Correo transaccional con Resend (dominio verificado, SPF/DKIM).

## 🟠 Necesario para cobrar
- [ ] Planes y cobro con Stripe (`Tenant.plan` existe pero no se usa): Checkout + Customer Portal + webhook que actualiza `plan`/`activo`.
- [ ] Límites por plan: obras, usuarios, almacenamiento.
- [ ] Trial y suspensión automática por falta de pago (conectar a `Tenant.activo`).
- [ ] Facturación CFDI (si se vende en México).
- [ ] Panel super-admin: ver, suspender y cambiar plan de empresas; soporte.

## 🟡 Operación
- [ ] Monitoreo de errores (Sentry) y logs estructurados (hoy `console.log`).
- [ ] Monitoreo de disponibilidad y alertas.
- [x] CI (no hay `.github/`): build + tests en cada push. Agregar script `test` en `server/package.json` (hay `*.test.ts` sin script). (2026-10-28: `.github/workflows/ci.yml`, `npm test` en server)
- [ ] Entorno de staging separado de producción.
- [ ] Dominio propio (no `*.fly.dev`), opcionalmente subdominio por cliente.
- [ ] Exportar todos los datos de una empresa y borrarla al terminar el contrato.

## 🟢 Legal y comercial
- [ ] Términos y condiciones, aviso de privacidad (LFPDPPP), SLA.
- [ ] Landing pública con precios y registro.
- [ ] Recorrido de bienvenida en la app (crear primera obra, invitar equipo).
- [ ] Canal de soporte y documentación de ayuda.

## Notas / decisiones
<!-- Anota aquí decisiones tomadas (p. ej. "se eligió Neon para Postgres", fecha). -->
- 2026-10-22: email de usuario único global (no se pide empresa al entrar).
- 2026-10-22: archivos con links firmados que caducan; al migrar a S3/R2 se reemplaza `urlFirmada` por URLs prefirmadas del bucket.
- 2026-10-28: hosting SaaS en **Vercel** (se deja Fly). Base de datos y archivos en **Supabase** (Postgres + Storage).
- 2026-10-28: correo transaccional con **Resend**; pagos con **Stripe** (tarjeta + OXXO).
