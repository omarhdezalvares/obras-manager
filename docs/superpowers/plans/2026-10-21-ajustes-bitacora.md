# Ajustes BITACORA — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver los 12 ajustes reportados en `Ajustes BITACORA.pdf` (herramientas, asistencias, transacciones, remisiones, empresa, fotos, presupuesto).

**Architecture:** Express + Prisma (SQLite) en `server/`, React + React Query + Tailwind en `web/`. Cada ajuste se resuelve en el módulo que ya existe (`server/src/modules/<x>/<x>.routes.ts` + su página/tab en `web/src/pages`). Solo #9 requiere migración de esquema.

**Tech Stack:** TypeScript, Express 4, Prisma 5, zod, exceljs, pdfkit, multer, React 18, @tanstack/react-query.

**Spec:** `C:\PROYECTOS\BITACORA\Ajustes BITACORA.pdf` (los números #1–#12 de este plan son los del documento).

## Global Constraints

- No hay framework de tests: las pruebas de lógica pura usan `node:test` + `node:assert` ejecutadas con `npx tsx --test <archivo>` (tsx ya está instalado; **no agregar dependencias**).
- Verificación mínima por tarea: `cd server && npx tsc --noEmit` y `cd web && npx tsc -b` sin errores, más la prueba manual indicada.
- Trabajo en la rama `ajustes-bitacora` (desde `main`), un commit por tarea.
- Roles: usar las constantes de `server/src/lib/roles.ts`; nunca strings sueltos en el server.
- Toda edición/eliminación de datos financieros o de asistencia escribe `writeAuditLog` (patrón de `transacciones.routes.ts`).
- Textos de UI en español, sin acentos en código (convención actual), con acentos permitidos en etiquetas visibles como ya hace la app.

## Review Focus

1. **Código de herramienta duplicado al editar (#4):** el usuario espera un mensaje "ya existe", no un 500 → el `errorHandler` ya traduce P2002 a 409; la prueba manual de Task 3 lo cubre.
2. **Eliminar asistencia que ya está ligada a un avance (#6):** debe borrarse sin romper el avance (se quitan los `AvancePersona` de esa asistencia) y el costo de mano de obra desaparece del presupuesto → prueba manual en Task 9.
3. **Cambiar la fecha de una asistencia a un día donde esa persona ya tiene asistencia (#6):** 409, no duplicado → Task 9.
4. **Ajuste de presupuesto en partidas antiguas con `presupuestoActualizado = 0` (#12):** el delta debe calcularse contra `presupuestoActualizado || presupuestoInicial`, si no una reducción se registra como aumento → test en Task 2.
5. **Subir 10 fotos y una falla (#10):** las demás deben subirse igual y avisar cuál falló → Task 6.

---

## Fase 1 — Correcciones rápidas

### Task 1: Custodio en el Excel de herramientas (#1)

**Files:**
- Modify: `server/src/modules/reportes/reportes.routes.ts:287`

Causa raíz: la columna usa solo `a.persona?.nombreCompleto`; las asignaciones capturadas con nombre libre guardan `custodioNombre`.

- [ ] **Step 1:** Cambiar a `custodio: a.persona?.nombreCompleto ?? a.custodioNombre ?? ""`.
- [ ] **Step 2: Verificar:** `npx tsc --noEmit`; descargar reporte de herramientas y confirmar que "Custodio actual" muestra el nombre en asignaciones con nombre libre y con persona.
- [ ] **Step 3: Commit** `fix(reportes): custodio libre en Excel de herramientas`

### Task 2: Signo correcto en ajustes de presupuesto (#12)

**Files:**
- Modify: `server/src/lib/finance.ts`
- Modify: `server/src/modules/transacciones/transacciones.routes.ts:44`
- Modify: `server/src/modules/reportes/reportes.routes.ts:343`
- Modify: `server/src/modules/partidas/partidas.routes.ts` (cálculo de `delta`)
- Modify: `web/src/pages/obra/TransaccionesTab.tsx:34-47`
- Test: `server/src/lib/finance.test.ts`

Causa raíz: `Math.abs(t.monto)` para todo lo que no es gasto, así un `ajuste_presupuesto` con monto negativo se muestra "+". Además el delta se calcula contra `presupuestoActualizado`, que puede ser 0 en partidas viejas.

**Interfaces:**
- Produces: `montoConSigno(tipo: string, monto: number): number` exportada de `server/src/lib/finance.ts`.

- [ ] **Step 1: Test que falla** en `server/src/lib/finance.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { montoConSigno } from "./finance";

test("gastos siempre negativos", () => assert.equal(montoConSigno("costo_mano_obra", 566.66), -566.66));
test("ajuste negativo se conserva negativo", () => assert.equal(montoConSigno("ajuste_presupuesto", -49314.3), -49314.3));
test("ajuste positivo positivo", () => assert.equal(montoConSigno("ajuste_presupuesto", 1000), 1000));
test("presupuesto inicial positivo", () => assert.equal(montoConSigno("presupuesto_inicial", 50000), 50000));
```

- [ ] **Step 2:** `cd server && npx tsx --test src/lib/finance.test.ts` → FAIL (`montoConSigno` no existe).
- [ ] **Step 3:** Implementar `montoConSigno`: gasto → `-Math.abs(monto)`; resto → `monto` tal cual. Usarla en `transacciones.routes.ts:44` y `reportes.routes.ts:343`.
- [ ] **Step 4:** En `partidas.routes.ts` PATCH: `const base = antes.presupuestoActualizado || antes.presupuestoInicial; const delta = cambios.presupuestoActualizado - base;` y usar `base` también en la condición `!==`.
- [ ] **Step 5:** En `TransaccionesTab.tsx` mostrar con `t.montoConSigno` (ya viene del server): signo `−`/`+` y color `text-crit`/`text-ok` según `montoConSigno < 0`; la Pill "Gasto/Presupuesto" no cambia.
- [ ] **Step 6:** Test → PASS; `tsc` en server y web; manual: bajar presupuesto de una partida y ver "−$X" en rojo en Transacciones.
- [ ] **Step 7: Commit** `fix(presupuesto): ajustes negativos se muestran como resta`

### Task 3: Editar código de herramienta (#4)

**Files:**
- Modify: `server/src/modules/herramientas/herramientas.routes.ts` (`updateSchema`)
- Modify: `web/src/pages/Herramientas.tsx` (`EditarHerramientaForm`)

- [ ] **Step 1:** Agregar `codigo: z.string().min(1).optional()` a `updateSchema`.
- [ ] **Step 2:** En `EditarHerramientaForm` agregar campo Codigo (mismo `toUpperCase()` que el alta) y enviarlo en el PATCH.
- [ ] **Step 3: Verificar:** cambiar código → se guarda; poner un código existente → mensaje de 409 en el formulario.
- [ ] **Step 4: Commit** `feat(herramientas): editar codigo`

### Task 4: Formularios de edición arriba (#3)

**Files:**
- Modify: `web/src/pages/Herramientas.tsx`, `web/src/pages/obra/PresupuestoTab.tsx`, `web/src/pages/obra/TransaccionesTab.tsx` (mover el render de `{editando && …}` / `{asignando && …}` encima de la lista)
- Modify: los mismos + `web/src/pages/Personas.tsx`, `web/src/pages/Seguridad.tsx` (botones Editar/Asignar)

- [ ] **Step 1:** Mover los formularios de edición/asignación justo debajo del encabezado, antes de la lista.
- [ ] **Step 2:** En cada `onClick` que abre edición/asignación, después del `setX(...)`, llamar `window.scrollTo({ top: 0, behavior: "smooth" })`.
- [ ] **Step 3: Verificar:** en una lista larga, Editar del último elemento lleva al formulario arriba (Herramientas, Personas, Seguridad, Presupuesto, Transacciones).
- [ ] **Step 4: Commit** `fix(ui): formularios de edicion al inicio de la pantalla`

### Task 5: Buscador en herramientas y obras (#5)

**Files:**
- Modify: `web/src/pages/Herramientas.tsx`, `web/src/pages/Obras.tsx`

Filtro en cliente (las listas ya se cargan completas), sin endpoint nuevo.

- [ ] **Step 1:** `Input` "Buscar…" sobre la lista; `useState` del texto; filtrar `query.data` con `includes` en minúsculas sobre: herramientas → `codigo`, `nombre`, `marca`, nombre del custodio, nombre de la obra; obras → `nombre`, `cliente`, `ubicacion`.
- [ ] **Step 2:** Si el filtro deja la lista vacía, `EmptyState` "Sin resultados para «…»".
- [ ] **Step 3: Verificar** escribiendo parte de un código (`SEHHT2`) y de un nombre de obra.
- [ ] **Step 4: Commit** `feat(ui): buscador de herramientas y obras`

### Task 6: Subir varias fotos a la vez (#10)

**Files:**
- Modify: `web/src/components/EvidenceUploader.tsx`

Aplica a todos los lugares que usan el componente (avances, asistencias, remisiones). El server no cambia: se sube una por una.

- [ ] **Step 1:** Agregar `multiple` al input de Galería (no al de Cámara).
- [ ] **Step 2:** En su `onChange`, recorrer `Array.from(e.target.files)` en secuencia con `await upload.mutateAsync(file)` dentro de `try/catch` por archivo; juntar los nombres fallidos y al final un solo `alert` con ellos. Quitar el `onError` con alert de `upload` para no duplicar avisos (mover ese alert al input de Cámara).
- [ ] **Step 3:** Mostrar progreso "Subiendo 2/5" en el botón mientras dura.
- [ ] **Step 4: Verificar** en celular: seleccionar 5 fotos de la galería → aparecen las 5; incluir un archivo no permitido → las demás suben y se avisa cuál falló.
- [ ] **Step 5: Commit** `feat(evidencias): carga multiple desde galeria`

---

## Fase 2 — Funcionalidad nueva

### Task 7: Asignar herramienta a un trabajador registrado (#2)

**Files:**
- Modify: `server/src/modules/herramientas/herramientas.routes.ts` (`asignarSchema`, POST `/:id/asignaciones`)
- Modify: `web/src/pages/Herramientas.tsx` (`AsignarForm`, `NuevaHerramientaForm`)

**Interfaces:**
- Produces: `POST /herramientas/:id/asignaciones` acepta `{ obraId?, personaId?, custodioNombre?, observaciones? }` (al menos uno de los tres primeros).

- [ ] **Step 1 (server):** Agregar `personaId: z.string().optional()` y ampliar el `refine` a `d.obraId || d.personaId || d.custodioNombre`. Si viene `personaId`, validar `prisma.persona.findFirst({ where: { id, tenantId, deletedAt: null } })` → 404 "Trabajador no encontrado". Guardar `personaId` en la asignación.
- [ ] **Step 2 (web, AsignarForm):** `Select` "Trabajador" con `GET /personas` (queryKey `["personas"]`, igual que la pantalla Personas), opciones por `nombreCompleto`, más opción "Otro (escribir nombre)" que muestra el `Input` de nombre libre actual. Enviar `personaId` o `custodioNombre`, nunca ambos.
- [ ] **Step 3 (web, NuevaHerramientaForm):** campos opcionales Trabajador y Obra (mismos selects); si alguno se llenó, tras crear la herramienta hacer el POST de asignación con el `id` devuelto.
- [ ] **Step 4: Verificar:** asignar a un trabajador → la tarjeta muestra "Con: <nombre>"; el Excel (Task 1) lo muestra; ese trabajador lo ve en "Mis herramientas".
- [ ] **Step 5: Commit** `feat(herramientas): asignar a trabajador registrado`

### Task 8: Bloqueo visible de asistencia ya registrada (#7)

**Files:**
- Modify: `web/src/pages/obra/AsistenciasTab.tsx`

El server ya rechaza duplicados (obra, persona, fecha); falta que la UI lo muestre antes de guardar.

- [ ] **Step 1:** Pasar `query.data` (asistencias de la obra) a `RegistrarAsistencia`. Calcular `yaRegistradas = Map<personaId, horaLlegada>` de las asistencias cuyo `fecha.slice(0,10) === fecha` seleccionada.
- [ ] **Step 2:** Para esas personas: checkbox deshabilitado, fila en gris y leyenda "Ya registrada (llegada HH:mm)". Al cambiar la fecha, quitar de `seleccion` las que queden bloqueadas (incluida la preselección del propio usuario).
- [ ] **Step 3: Verificar:** el Oficial registra a X hoy; el Admin abre la obra → X aparece bloqueado con su hora; al cambiar a ayer se habilita.
- [ ] **Step 4: Commit** `feat(asistencias): bloquear personas con asistencia del dia`

### Task 9: Editar y eliminar asistencia (#6)

**Files:**
- Modify: `server/src/lib/roles.ts`
- Modify: `server/src/modules/asistencias/asistencias.routes.ts`
- Modify: `web/src/pages/obra/AsistenciasTab.tsx`, `web/src/pages/ObraDetail.tsx` (pasar el permiso)

**Interfaces:**
- Produces: `ASISTENCIA_EDICION: RoleName[] = [ROLES.ADMIN, ROLES.FINANZAS, ROLES.GERENTE]`
- Produces: `PATCH /obras/:obraId/asistencias/:asistenciaId` body `{ fecha?: string, horaLlegada?: string, observaciones?: string }` → asistencia actualizada.
- Produces: `DELETE /obras/:obraId/asistencias/:asistenciaId` → 204.

- [ ] **Step 1 (PATCH):** `requireRole(...ASISTENCIA_EDICION)`, `assertObraVisible`, buscar por `id + obraId + tenantId` (404 si no). Normalizar `fecha` con `startOfDay`. Actualizar; si cambia la fecha, actualizar también `descripcion` de su transacción. Duplicado de fecha → P2002 → 409 (ya lo maneja `errorHandler`). `writeAuditLog` con antes/después.
- [ ] **Step 2 (DELETE):** en `prisma.$transaction`: borrar `avancePersona` con ese `asistenciaId`, la `transaccion` con ese `asistenciaId`, las `evidencia` con `entidadTipo: "asistencia", entidadId`, y la asistencia. Después, `fs.unlink` de los archivos de esas evidencias (mismo patrón que `evidencias.routes.ts:116`). `writeAuditLog` accion `eliminar` con la asistencia y el monto borrado.
- [ ] **Step 3 (web):** en `ObraDetail.tsx` calcular `puedeEditarAsistencia` con roles Administrador, Finanzas, Gerente de Proyecto y pasarlo a `AsistenciasTab`. En cada tarjeta del historial: botón "Editar" (form en línea: fecha, hora, observaciones) y "Eliminar" con `confirm("¿Eliminar asistencia? Se quitará su costo de mano de obra.")`. Al terminar, invalidar `["asistencias", obraId]`, `["transacciones", obraId]` y las queries de presupuesto de la obra.
- [ ] **Step 4: Verificar:** Admin cambia hora → se ve; cambia fecha a un día ya ocupado → mensaje 409; elimina una asistencia ligada a un avance → el avance sigue y ya no lista a esa persona; el consumo de mano de obra baja. Oficial y Supervisor no ven los botones y el server responde 403.
- [ ] **Step 5: Commit** `feat(asistencias): editar y eliminar (admin, finanzas, gerente)`

### Task 10: Bonos y comisiones (#8)

**Files:**
- Modify: `server/src/lib/finance.ts` (`COSTO_TIPOS`)
- Modify: `server/src/modules/asistencias/asistencias.routes.ts:126` (usar `COSTO_TIPOS` en vez de la lista fija)
- Modify: `server/src/modules/transacciones/transacciones.routes.ts` (`createSchema`)
- Modify: `server/src/modules/reportes/reportes.routes.ts:305-315` (resumen por obra)
- Modify: `web/src/lib/types.ts:130` (`TIPOS_GASTO`), `web/src/pages/obra/TransaccionesTab.tsx`
- Test: `server/src/lib/finance.test.ts`

Decisión: bonos y comisiones son transacciones de gasto (`tipo: "bono" | "comision"`) dentro de Transacciones de la obra, ligadas opcionalmente a un trabajador; restan del presupuesto de la partida elegida. Solo `TRANSACCION_GESTION` (Admin, Finanzas). No se tocan remisiones.

- [ ] **Step 1: Test que falla** (agregar a `finance.test.ts`):

```ts
import { esGasto } from "./finance";
test("bono y comision son gasto", () => {
  assert.equal(esGasto("bono"), true);
  assert.equal(esGasto("comision"), true);
  assert.equal(montoConSigno("bono", 1500), -1500);
});
```

- [ ] **Step 2:** `npx tsx --test src/lib/finance.test.ts` → FAIL.
- [ ] **Step 3:** Agregar `"bono"`, `"comision"` a `COSTO_TIPOS` (server) y `TIPOS_GASTO` (web); `createSchema.tipo` → `z.enum(["otro_costo", "ajuste_presupuesto", "devolucion", "bono", "comision"])` y `monto: z.number().positive()` para bono/comision (validar con `refine`). Si viene `personaId`, validar que pertenezca al tenant.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5 (reporte):** en el resumen por obra, sumar `bono` + `comision` en una columna nueva "Bonos/comisiones" junto a mano de obra/material/otros.
- [ ] **Step 6 (web):** en `TransaccionesTab` (solo si `puedeEditar`), botón "+ Bono / comisión" que abre arriba un form: Tipo (Bono | Comisión), Trabajador (de las personas de la obra, opcional), Partida (default la de mano de obra), Monto, Descripción → `POST /obras/:obraId/transacciones`. Agregar `bono: "Bono"`, `comision: "Comisión"` a `TIPO_LABEL` y mostrar el nombre de la persona igual que en `costo_mano_obra`.
- [ ] **Step 7: Verificar:** registrar bono de $1,500 a un trabajador → aparece "−$1,500" en rojo, el consumido de la partida sube $1,500, aparece en el Excel de transacciones.
- [ ] **Step 8: Commit** `feat(transacciones): bonos y comisiones`

### Task 11: Editar remisiones (#11)

**Files:**
- Modify: `server/src/modules/remisiones/remisiones.routes.ts`
- Modify: `web/src/pages/obra/RemisionesTab.tsx`

**Interfaces:**
- Produces: `PATCH /obras/:obraId/remisiones/:remisionId` con el mismo body que el POST (`createSchema`) más `motivo: string` (min 1) → remisión actualizada.

- [ ] **Step 1 (server):** `requireRole(...REMISION_GESTION)`, `assertObraVisible`, remisión por `id + obraId + tenantId + deletedAt: null` (404). Validar partida destino. En `$transaction`: actualizar cabecera y `costoTotal` (mismo `reduce` que el POST; extraerlo a una función local `calcularCostoTotal(materiales)` usada por ambos), `deleteMany` + `createMany` de `remisionMaterial`, y `updateMany` de la transacción con ese `remisionId` (`monto`, `partidaId`, `descripcion`, `motivoAjuste: motivo`, `updatedBy`). `writeAuditLog` con antes/después.
- [ ] **Step 2 (web):** botón "Editar" en cada remisión; reutilizar el formulario de alta existente en `RemisionesTab` precargado con proveedor, folio, fecha, partida y líneas, más campo Motivo; render arriba + scroll (patrón de Task 4).
- [ ] **Step 3: Verificar:** cambiar cantidad de una línea → el total de la remisión y su transacción "Costo de material" cambian; la transacción aparece como "Editada" con el motivo.
- [ ] **Step 4: Commit** `feat(remisiones): editar remision`

---

## Fase 3 — Marca de la empresa

### Task 12: Logo y color en Empresa y en reportes (#9)

**Files:**
- Modify: `server/prisma/schema.prisma` (Tenant) + nueva migración
- Modify: `server/src/modules/empresa/empresa.routes.ts`
- Modify: `server/src/lib/avancesPdf.ts`, `server/src/modules/avances/avances.routes.ts:114-117`
- Modify: `server/src/modules/reportes/reportes.routes.ts` (encabezados de hojas)
- Modify: `web/src/pages/Empresa.tsx`

**Interfaces:**
- Produces: `Tenant.logoKey String?`, `Tenant.colorPrimario String?` (hex `#RRGGBB`).
- Produces: `POST /empresa/logo` (multipart, campo `logo`, solo `EMPRESA_GESTION`) → empresa con `logoUrl`.
- Produces: `GET /empresa` incluye `colorPrimario` y `logoUrl` (`/uploads/<logoKey>` o null).

- [ ] **Step 1:** Agregar los dos campos a `Tenant`; `cd server && npx prisma migrate dev --name tenant_marca`.
- [ ] **Step 2:** `editarEmpresaSchema`: `colorPrimario: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal(""))`. Agregar a `empresaSelect` y responder `logoUrl`.
- [ ] **Step 3:** `POST /empresa/logo` con `upload.single("logo")`; rechazar con 400 todo lo que no sea `image/png` o `image/jpeg` (pdfkit solo admite esos) y borrar el archivo rechazado; guardar `logoKey` y borrar el logo anterior del disco.
- [ ] **Step 4 (PDF):** `TenantHeader` gana `logoKey` y `colorPrimario`; el encabezado usa `colorPrimario ?? ACCENT` como relleno y, si hay logo, `doc.image(ruta, MARGIN, 18, { fit: [56, 56] })` corriendo el texto a la derecha. Incluir los campos en el `select` de `avances.routes.ts`.
- [ ] **Step 5 (Excel):** al crear cada hoja, rellenar la fila de encabezados con `colorPrimario` (`argb: "FF" + hex sin #`) y texto blanco, solo si está definido.
- [ ] **Step 6 (web):** en `Empresa.tsx` modo edición: `<input type="color">` para el color y selector de archivo para el logo (sube al elegir); en modo lectura, vista previa del logo y una muestra del color.
- [ ] **Step 7: Verificar:** subir logo PNG y color `#1F4E79` → el PDF de evidencias sale con ese encabezado y logo; Excel con encabezados de ese color; subir un `.webp` → 400 con mensaje claro.
- [ ] **Step 8: Commit** `feat(empresa): logo y color en reportes`

---

## Orden sugerido y esfuerzo

| Fase | Tareas | Esfuerzo aprox. |
|---|---|---|
| 1 | 1, 2, 3, 4, 5, 6 | ½–1 día |
| 2 | 7, 8, 9, 10, 11 | 2–3 días |
| 3 | 12 | ½–1 día |

Despliegue: la Task 12 trae migración; `docker-entrypoint.sh` debe correr `prisma migrate deploy` (confirmar antes de subir a Fly).
