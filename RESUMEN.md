# Resumen del proyecto — Bitácora (OBRA/OS)

> Este archivo es memoria de contexto para que cualquier sesión de Claude (u otra persona) entienda
> qué es la app, cómo está armada y qué se ha hecho, sin depender del historial de chat. Actualízalo
> cuando se agreguen funcionalidades o se tomen decisiones de producto importantes.

## Qué es la app

**Bitácora** (nombre de producto; nombre técnico interno del repo: OBRA/OS) es una plataforma de
control operativo y financiero para empresas de instalación (eléctrica, audio/video, redes,
infraestructura tecnológica) que ejecutan obras/proyectos en campo. Cubre: asistencia de personal,
avances de obra con evidencia fotográfica, presupuesto por partidas, transacciones financieras
auditadas, remisiones de material, control de herramientas con custodia, reportes exportables y
alertas básicas. Es multi-tenant (varias empresas/clientes en la misma base de datos, aisladas por
`tenantId`).

Es una **versión de test/piloto** de una especificación más grande pensada para producción con
NestJS + PostgreSQL + S3 + Redis. Este repo usa un stack simplificado que corre sin infraestructura
externa, manteniendo el mismo modelo de datos y las mismas reglas de negocio (ver tabla de
diferencias en `README.md`).

## Stack

- **Backend**: `server/` — Express + TypeScript, Prisma + SQLite, JWT (access + refresh token),
  multer para subida de archivos a disco local, ExcelJS para reportes, PDFKit para el reporte PDF,
  archiver para el .zip de fotos.
- **Frontend**: `web/` — React + Vite + TypeScript + Tailwind, React Router, TanStack Query, Axios.
  Mobile-first para el flujo de campo del Oficial. Es una **PWA instalable** (manifest + service
  worker vía `vite-plugin-pwa`).
- **Despliegue**: Fly.io, app `bitacora-app` → https://bitacora-app.fly.dev/. Un solo contenedor
  Docker sirve el API (`/api/*`) y el build estático del frontend desde el mismo proceso Express
  (ver `server/src/index.ts` y `Dockerfile`/`fly.toml` en la raíz). Volumen persistente `/data` para
  la base SQLite y los archivos subidos (`UPLOAD_DIR`).

## Modelo de datos (Prisma, `server/prisma/schema.prisma`)

`Tenant` (empresa) → `Usuario` (login, con `Rol`) y `Persona` (trabajador de campo, puede o no tener
`Usuario` asociado) → `Obra` (proyecto) → `ObraPersona` (asignación), `Asistencia` (registro diario,
único por obra+persona+fecha), `Avance` (evidencia diaria: fecha + descripción, internamente sigue
llamándose "Avance" — ver sección de terminología abajo) con `AvancePersona` (quién estuvo presente
ese día, se auto-calcula desde `Asistencia`), `Evidencia` (foto/archivo genérico, reutilizado por
`asistencia|avance|remision|herramienta` vía `entidadTipo`/`entidadId`, sin relación FK real —
resuelta a mano en cada módulo), `PartidaPresupuestal` + `Transaccion` (libro contable por partida),
`Remision` + `RemisionMaterial` (entradas de material), `Herramienta` + `HerramientaAsignacion`
(custodia única, puede ser una `Persona` o un nombre libre de contratista externo). `AuditLog`
registra cambios críticos (partidas, transacciones, obra, evidencias borradas/editadas). `Notificacion`
son alertas persistidas; el endpoint `/notificaciones` también calcula en vivo "obra sin actividad" y
"evidencia sin fotos".

## Roles y permisos (`server/src/lib/roles.ts`, sección 06 del doc original)

`Administrador` (todo), `Gerente de Proyecto` (gestión, sin datos financieros), `Supervisor`
(operativo, ve presupuesto pero no el libro de transacciones), `Oficial` (solo su flujo de campo
móvil, sin nada financiero), `Finanzas` (todo lo financiero), `Solo lectura` (todo en modo consulta,
nunca puede mutar nada). El backend sanea las respuestas (omite campos financieros) y no solo
esconde botones en el frontend.

## Flujos principales

### Gestión (Administrador/Gerente/Supervisor/Finanzas/Lectura) — escritorio

- **Dashboard**: resumen de obras + alertas (sin actividad, evidencia sin fotos, sobreconsumo).
- **Obras** → **Detalle de obra** con pestañas: Resumen, Personas, Asistencias, **Evidencias**
  (antes "Avances", ver abajo), Presupuesto, Transacciones, Remisiones, Herramientas.
- **Personas**, **Herramientas**, **Reportes** (exporta a Excel: evidencias, asistencias,
  presupuesto vs. real, materiales por remisión, herramientas, costos, transacciones — filtrable por
  obra/persona/fecha).
- **Seguridad** (gestión de usuarios, solo Administrador) y **Empresa** (perfil de la empresa: razón
  social, RFC, dirección, contacto — solo Administrador edita).

### Campo (Oficial) — móvil, PWA instalable

`Mis obras` → elige obra → elige proceso:
- **Asistencia**: marca quién llegó, hora editable, foto opcional, fecha editable (tope en hoy).
- **Evidencia**: fecha editable (tope en hoy), descripción, foto **obligatoria**.

`Herramientas` (las que trae asignadas) y `Historial` (sus asistencias y evidencias recientes; ya
no es 100% solo-lectura, ver "Editar evidencias" abajo).

## Funcionalidades agregadas en las sesiones más recientes (con esta memoria)

Esto es lo que se construyó **después** del build inicial documentado en `README.md`. Está en orden
cronológico porque cada punto a veces da contexto del siguiente:

1. **Rebrand a "Bitácora"** + módulos de Seguridad y Empresa, y despliegue a Fly.io (Dockerfile,
   `fly.toml`, `server/prisma/seedProd.ts` para poblar producción sin los datos de demo del piloto).
2. **PWA instalable**: manifest + iconos + service worker (`vite-plugin-pwa`), y ajuste de
   `padding-top`/`padding-bottom` con `env(safe-area-inset-*)` en el header y el nav inferior
   (`web/src/components/Layout.tsx`) para que no se traslapen con la barra de estado/gestos del
   celular al instalarla como app.
3. **Selector de fecha en registro de asistencias y remisiones** (antes fijo a "hoy"), tanto en el
   lado de obra/admin como en el flujo del Oficial.
4. **Eliminar evidencias** (fotos): `DELETE /api/evidencias/:id`. El Oficial solo borra lo que él
   mismo subió (`subidaPor === usuario.id`); Administrador/Gerente/Supervisor/Finanzas borran
   cualquiera dentro de su alcance de obra; `Solo lectura` nunca puede. Queda un botón "×" en cada
   miniatura de `web/src/components/EvidenceUploader.tsx` (componente compartido, así que el cambio
   aplica automáticamente en todos los lugares donde se usa). Cada borrado queda en `AuditLog`.
5. **Reporte PDF de evidencias para el cliente** (solo Administrador): `GET
   /api/obras/:obraId/avances/reporte-pdf?desde=&hasta=`, generado con PDFKit
   (`server/src/lib/avancesPdf.ts`): encabezado con datos de la empresa y de la obra, evidencias
   agrupadas por día con descripción, personal presente y cuadrícula de fotos (solo JPEG/PNG se
   embeben; otros formatos muestran un placeholder "no visualizable"), paginación automática con pie
   de página. Vive dentro de la pestaña de evidencias de la obra (`ReportePdfCard` en
   `web/src/pages/obra/AvancesTab.tsx`).
6. **Descargar todas las fotos de una obra en .zip**: `GET /api/obras/:obraId/avances/fotos.zip`
   (usa `archiver`), organiza las fotos en carpetas por fecha (`2026-07-29/foto-1.png`, etc.),
   disponible para cualquiera con acceso a la obra (no solo Administrador). 404 con mensaje claro si
   la obra no tiene fotos.
7. **Unificación de terminología "Avance" → "Evidencia"** en todo el texto visible al usuario (tabs,
   botones, vacíos, reportes, notificaciones, nombres de archivo descargado), en ambos lados
   (Oficial y gestión). **El modelo de datos, la tabla, las rutas internas (`/avances`, `avanceId`,
   `entidadTipo: "avance"`) y los tipos TS siguen llamándose `Avance`** — es una decisión deliberada
   para no requerir migración de base de datos ni tocar el contrato interno; solo cambió lo que la
   gente lee. Si se retoma esto, la ruta `GET /avances/:avanceId` quedó con el mensaje interno
   "Avance no encontrado" sin renombrar porque no la usa ningún flujo del frontend hoy.
8. **Editar una evidencia ya guardada** (fecha y descripción, no solo la foto): `PATCH
   /api/obras/:obraId/avances/:avanceId`. Mismo criterio de permisos que el borrado (Oficial solo lo
   propio vía `registradoPor === usuario.id`; Administrador/Supervisor cualquiera en su alcance). Si
   cambia la fecha, se recalcula el personal vinculado (`AvancePersona`) contra las asistencias del
   nuevo día, igual que al crearla. Hay un botón "Editar" en cada tarjeta del historial, tanto en
   `AvancesTab.tsx` (obra/admin) como en `Historial.tsx` (Oficial, solo en sus propias evidencias).
   - Efecto colateral que se corrigió: `GET /mi-historial` originalmente listaba las evidencias del
     Oficial por vínculo de asistencia (`AvancePersona`) en vez de por `registradoPor`; al permitir
     editar la fecha, una evidencia podía "desaparecer" del historial de quien la escribió si la
     nueva fecha no tenía una asistencia propia ese día. Se corrigió en
     `server/src/modules/historial/historial.routes.ts` para filtrar por `registradoPor`.
9. **Selector de fecha en "Registrar evidencia" del lado de obra/admin** (antes fijo a "hoy", el
   Oficial ya lo tenía). Decisión explícita del usuario: el tope sigue siendo "hoy" (no se permiten
   fechas futuras) — cubre el caso de "se me olvidó cargar la de ayer/la semana pasada", no el de
   registrar trabajo que aún no se hizo.

## Credenciales de demo (solo entorno local/seed de piloto, `server/prisma/seed.ts`)

Contraseña para todos: `obraos2026`. `edgar@piloto.test` (Administrador), `lucia@piloto.test`
(Gerente), `marco@piloto.test` (Supervisor), `ivan@piloto.test` / `rosa@piloto.test` (Oficial),
`karla@piloto.test` (Finanzas), `auditoria@piloto.test` (Solo lectura). En producción se usa
`server/prisma/seedProd.ts` (sin estos datos de demo, crea solo el tenant y un usuario Administrador
desde variables de entorno).

## Cómo correr y desplegar

Ver `README.md` para levantar el entorno local (`npm install` + `prisma migrate dev` en `server/`,
`npm run dev` en ambos). Para desplegar a producción: `git push` a `main` y luego `fly deploy --app
bitacora-app` desde la raíz del repo (requiere `flyctl` autenticado). Hay un warning conocido y sin
resolver de Fly: `DATABASE_URL` está en texto plano en `fly.toml` en vez de como `fly secrets set`
— no bloquea nada, pero es una mejora pendiente si se quiere ser estricto con secretos.

## Cosas a tener en cuenta si vas a seguir trabajando aquí

- El componente `EvidenceUploader.tsx` es compartido por todos los flujos que suben/borran fotos
  (asistencia, evidencia/avance, remisión, herramienta) — cualquier cambio ahí impacta todo a la vez.
- `assertObraVisible` + `visibleObraIds` (`server/src/lib/obraScope.ts`) son el mecanismo central de
  aislamiento por obra; cualquier ruta nueva que toque datos de una obra debe pasar por ahí.
- Los reportes (Excel, PDF, .zip) se generan de forma síncrona en la misma llamada HTTP — es
  intencional para el volumen de un piloto de 2-3 obras, no uses una cola de trabajos sin que el
  volumen real lo justifique.
- `dev.db` y `uploads/` están en `.gitignore` — nunca deberían aparecer en un commit.
- Antes de dar por hecho que algo "ya se hizo", revisa el código: varias veces en esta sesión el
  usuario preguntó por el estado de algo y la respuesta correcta fue "parcialmente" (ver el punto de
  terminología arriba, que se hizo primero solo en el lado Oficial y después se completó del todo).
