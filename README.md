# OBRA/OS — versión de test

Implementación funcional de la especificación **OBRA/OS** (plataforma de control operativo y financiero de obras de instalación eléctrica, audio, video, redes e infraestructura tecnológica) para probar el flujo completo del piloto de 3 meses descrito en el documento.

Cubre el alcance completo del piloto (mes 1–3): auth y roles, obras/personas, asistencia móvil con transacción automática, avances con evidencia, presupuesto por partidas, transacciones editables con motivo auditado, remisiones de material, herramientas con custodia única, reportes exportables a Excel y alertas básicas.

## Diferencias con la arquitectura de producción propuesta

El documento recomienda NestJS + PostgreSQL + S3 + Redis/BullMQ + Docker/AWS para producción. Esta versión de test usa un stack simplificado **para poder correrla en minutos sin infraestructura externa**, manteniendo el mismo modelo de datos y las mismas reglas de negocio:

| Aspecto | Documento (producción) | Esta versión de test |
|---|---|---|
| Backend | NestJS | Express + TypeScript (mismos módulos, mismas rutas) |
| Base de datos | PostgreSQL + Row-Level Security | SQLite + Prisma (aislamiento por `tenantId` a nivel de aplicación, no RLS nativo) |
| Evidencias | S3 con URL prefirmada | Disco local (`server/uploads/`), mismo modelo `bucket/objectKey` |
| Hash de contraseña | Argon2id | bcryptjs (sin dependencias nativas de compilación) |
| Reportes Excel | Job en worker (BullMQ) + descarga posterior | Generación síncrona en la misma llamada (rápido para 2-3 obras) |
| Notificaciones | Email/push | Tabla `notificaciones` + cálculo en vivo, consultable en el dashboard |
| Modo offline | Fuera del piloto (confirmado en el documento, sección 15) | No implementado |

Migrar a Postgres/S3/NestJS después es viable sin rediseño: el modelo de datos y las reglas de negocio (sección 05/13 del documento) son idénticos.

## Estructura

```
server/   API (Express + TypeScript + Prisma + SQLite)
web/      Frontend (React + Vite + TypeScript + Tailwind, mobile-first)
```

## Puesta en marcha

Requiere Node.js 18+.

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
npx prisma migrate dev --name init   # crea la base SQLite y siembra datos de demo
npm run dev                           # http://localhost:4000
```

### 2. Frontend

En otra terminal:

```bash
cd web
npm install
npm run dev                           # http://localhost:5173
```

Abre `http://localhost:5173`. El frontend hace proxy de `/api` y `/uploads` hacia el backend (`vite.config.ts`), así que no hay que configurar CORS manualmente para desarrollo.

### Reiniciar los datos de demo

```bash
cd server
npx prisma migrate reset --force
```

## Usuarios de demo

Contraseña para todos: **`obraos2026`**

| Rol | Email |
|---|---|
| Administrador | `edgar@piloto.test` |
| Gerente de Proyecto | `lucia@piloto.test` |
| Supervisor | `marco@piloto.test` |
| Oficial | `ivan@piloto.test` / `rosa@piloto.test` |
| Finanzas | `karla@piloto.test` |
| Solo lectura | `auditoria@piloto.test` |

Los datos de demo incluyen 3 obras (dos en ejecución, una planeada), personas asignadas, unos días de asistencias/avances con sus transacciones ya generadas, una remisión de material y herramientas asignadas (incluida una a un custodio con nombre libre) — para que el dashboard de presupuesto vs. real muestre números reales desde el primer login.

## Acceso a información financiera por rol

Ajuste de negocio posterior al documento original: **Oficial** y **Gerente de Proyecto** no ven ningún dato financiero ni de presupuesto en ninguna pantalla (dashboard, obras, reportes, transacciones). Esto se aplica tanto en la UI como en el API (el backend omite esos campos y devuelve 403 en los endpoints de partidas/transacciones/reportes financieros para esos roles). El resto de la matriz de la sección 06 del documento se mantiene: Supervisor puede consultar presupuesto pero no el libro de transacciones; Administrador, Finanzas y Solo lectura sí ven todo.

## Flujo de campo del Oficial

Rediseñado para ser mínimo: **Mis obras → selecciona la obra → elige el proceso (Asistencia o Evidencia) → llena solo lo necesario para ese proceso.**

- **Asistencia**: marca quién llegó, hora editable, foto **opcional** al final.
- **Evidencia** (antes "Avance"): fecha de registro **editable**, descripción, y foto **obligatoria** — no se puede finalizar sin al menos una.

El Oficial nunca ve costos, presupuesto ni el detalle de obra completo (esa vista de gestión es para Administrador/Supervisor/Gerente/Finanzas).

## Qué probar primero

1. **Entra como `edgar@piloto.test`** (Administrador) → Dashboard: verás las 3 obras con su % de presupuesto consumido, calculado en tiempo real desde las transacciones (no un campo cacheado).
2. Abre la obra **"Cableado estructurado - Torre Norte"** → pestaña **Presupuesto**: cada partida muestra consumido/disponible/% con barra de progreso. Prueba **"Editar obra"** para cambiar su estado o presupuesto.
3. Pestaña **Transacciones**: verás el libro mayor con montos en **verde (presupuesto/devoluciones)** y **rojo (gastos)**, y el nombre de la persona en cada transacción de mano de obra. Como Administrador puedes editar una (el motivo de ajuste es obligatorio) y verás cómo se marca "Editada".
4. **Cierra sesión y entra como `lucia@piloto.test`** (Gerente de Proyecto): confirma que no hay ninguna cifra de dinero en ningún lado — ni en Dashboard, ni en Obras, ni en el detalle de obra (no aparecen las pestañas Presupuesto/Transacciones).
5. **Cierra sesión y entra como `ivan@piloto.test`** (Oficial): la navegación cambia a la vista de campo. Entra a **Mis obras** → una obra → **Asistencia** → marca presentes y guarda (foto opcional). Verifica en el dashboard del Administrador que el presupuesto de esa partida subió inmediatamente, aunque Ivan nunca vio ese número.
6. Desde la misma obra, entra a **Evidencia**: cambia la fecha de registro, escribe la descripción y verifica que el botón "Finalizar" está bloqueado hasta que subas al menos una foto.
7. Intenta registrar la asistencia de Ivan una segunda vez el mismo día: el sistema la rechaza por duplicidad (obra + persona + fecha).
8. Entra como `karla@piloto.test` (Finanzas) y edita una transacción — comprueba que Ivan (Oficial), Lucía (Gerente) o Marco (Supervisor) **no** pueden hacerlo.
9. Ve a **Reportes** como Administrador y exporta "Presupuesto vs. real" o "Transacciones / ajustes" — los montos vienen con signo y color en el Excel. Entra como Gerente y confirma que esos dos reportes ya no aparecen en la lista.
10. Ve a **Herramientas**, asigna una a un **nombre libre** (no tiene que ser una persona registrada en el sistema) y confirma que la asignación anterior se cierra automáticamente. Prueba también **"Editar"** sobre una herramienta ya creada.
11. En **Personas**, edita a alguien ya existente (el botón "Editar" abre el mismo formulario con sus datos precargados).

## Notas de seguridad de esta versión de test

- Los tokens (access + refresh) se guardan en `localStorage` del navegador por simplicidad; producción debería usar cookies `httpOnly` para el refresh token.
- No hay rate limiting ni escaneo antivirus de archivos subidos (sí se valida tipo MIME y tamaño máximo de 15MB).
- El aislamiento multi-tenant se aplica en cada consulta vía `tenantId` explícito en el código de aplicación; producción debería añadir Row-Level Security de Postgres como segunda barrera, tal como indica la sección 10 del documento.
