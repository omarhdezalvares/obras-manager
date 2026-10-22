# Checklist para distribuir Bitácora como SaaS

> Seguimiento entre sesiones. Marca `[x]` al terminar un punto y anota la fecha/commit al lado.
> Antes de marcar algo, verifica en el código (no supongas). Creado: 2026-10-22.
>
> Orden sugerido: 🔴 Seguridad → 🔴 Infraestructura → 🔴 Onboarding → 🟠 Cobro → 🟡 → 🟢.

## 🔴 Bloqueantes (antes del primer cliente que paga)

### Seguridad y aislamiento entre clientes
- [x] `/uploads` es público (`server/src/index.ts`, `express.static`). Servir archivos con `requireAuth` y validar que la evidencia sea del tenant del usuario. (2026-10-22, sin commit: links firmados HMAC que caducan en 6–12 h, `server/src/lib/uploadUrl.ts`; solo los emiten rutas que ya validaron tenant/obra)
- [x] Secretos JWT tienen fallback de desarrollo (`server/src/env.ts`). Fallar al arrancar si faltan en producción. (2026-10-22, sin commit; antes de desplegar confirmar `fly secrets list` tiene `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`)
- [x] Login busca el email en todos los tenants (`auth.routes.ts`, `findFirst`) pero el email solo es único por tenant → si se repite entre empresas entra a la equivocada. Pedir tenant (slug/subdominio) o hacer el email único global. (2026-10-22, sin commit: email único global, migración `20261022120000_email_unico_global`)
- [ ] Rate limiting en login, refresh y subida de archivos.
- [ ] Test automático de aislamiento: usuario del tenant A no puede leer/escribir datos del tenant B (cada módulo).

### Infraestructura
- [ ] Migrar SQLite → PostgreSQL administrado (Fly Postgres / Neon / Supabase).
- [ ] Archivos de disco local → S3 / Cloudflare R2 / Tigris con URLs firmadas.
- [ ] Backups automáticos de BD y archivos, con restauración probada.
- [ ] Ajustar `fly.toml`: `min_machines_running = 0` y `256mb` dan arranques en frío; dejar ≥1 máquina para clientes de pago.

### Onboarding
- [ ] Registro self-service: crea tenant + admin + roles (hoy solo `seedProd.ts` a mano).
- [ ] Recuperar contraseña por correo.
- [ ] Invitación de usuarios por correo.
- [ ] Proveedor de correo transaccional (Resend / SES / Postmark).

## 🟠 Necesario para cobrar
- [ ] Planes y cobro (`Tenant.plan` existe pero no se usa): Stripe, o Conekta / Mercado Pago para México.
- [ ] Límites por plan: obras, usuarios, almacenamiento.
- [ ] Trial y suspensión automática por falta de pago (conectar a `Tenant.activo`).
- [ ] Facturación CFDI (si se vende en México).
- [ ] Panel super-admin: ver, suspender y cambiar plan de empresas; soporte.

## 🟡 Operación
- [ ] Monitoreo de errores (Sentry) y logs estructurados (hoy `console.log`).
- [ ] Monitoreo de disponibilidad y alertas.
- [ ] CI (no hay `.github/`): build + tests en cada push. Agregar script `test` en `server/package.json` (hay `*.test.ts` sin script).
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
