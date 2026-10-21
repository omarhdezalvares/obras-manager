# Mejoras UX — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar las mejoras de UX del recorrido (errores E1–E6, oficial O1–O8, admin C1–C12, accesibilidad D1–D3) y entregar la maqueta de reorganización de pestañas (E) para aprobación.

**Architecture:** Cambios casi todos en `web/` (React + React Query + Tailwind), reutilizando `components/ui.tsx`, `lib/api.ts` y React Query. El server solo se extiende en tres puntos: `GET /obras` (presupuesto oficial, estado de hoy, alerta de partida), `GET /personas` (obras activas) y el Excel de costos. La lógica nueva no trivial vive en funciones puras de `web/src/lib/*` y `server/src/lib/*`, con pruebas.

**Tech Stack:** TypeScript, React 18, @tanstack/react-query, Tailwind, Express 4, Prisma 5 (SQLite), exceljs.

**Spec:** `docs/superpowers/specs/2026-10-21-mejoras-ux-design.md`

## Global Constraints

- Rama `mejoras-ux` desde `ajustes-bitacora`; un commit por tarea con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Sin dependencias nuevas.
- Pruebas de lógica: `node:test` + `node:assert/strict`, archivo `*.test.ts` junto al módulo; se corren con `server/node_modules/.bin/tsx --test <archivo>` (desde la raíz `obras-manager`). Los `*.test.ts` ya están excluidos de ambos `tsconfig`.
- Verificación de compilación en cada tarea: `cd server && npx tsc --noEmit -p .` y `cd web && npx tsc -b`, ambos sin salida de error.
- Verificación de UI: script Playwright de solo lectura `ux-check.cjs` en el scratchpad (usa `C:/PROYECTOS/FAMILYCORE/FamilyCore/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright`, como `tour.cjs` del recorrido), contra `http://localhost:5174` con `edgar@piloto.test` / `ivan@piloto.test` y la contraseña `obraos2026`. Cada tarea de UI agrega sus aserciones (texto visible / ausencia de texto) a ese script; viewport 390×844 para oficial y 1366×860 para admin.
- **Nombres de la app no cambian** (Partida, Transacciones, Evidencias…). Solo se traducen valores crudos (C9).
- "Hoy" = `hoyLocal()` del cliente; el server recibe `fecha=YYYY-MM-DD` y usa `startOfDay` (`server/src/lib/dates.ts`). El server nunca calcula "hoy" por sí mismo.
- El oficial nunca recibe datos financieros (respetar `puedeVerFinanciero` en server y web).
- Ninguna cifra de dinero cambia de valor, salvo el "% del presupuesto" del Excel "Costos por obra" (E2).

## Review Focus

1. **Registro entre 18:00 y 23:59 hora de México:** asistencia/evidencia deben quedar con la fecha del día local → test de `hoyLocal` con `new Date(2026, 9, 21, 23, 30)` en Task 1.
2. **Usuario admin/oficial sin persona o no asignado a la obra:** ni preselección (E4) ni "Registrar mi llegada" (O3) deben aparecer ni contar → test de `seleccionInicial` (Task 4) y aserción UI (Task 7).
3. **Oficial pierde fotos si falta la descripción al registrar evidencia (O5):** validar texto antes de crear/subir; las fotos elegidas permanecen en pantalla → aserción en Task 8.
4. **Obra sin partidas o con presupuesto 0:** barra y alerta no deben dividir entre cero ni mostrar `NaN%` → test de `alertaPartida` y `porcentaje` (Task 3).
5. **Rol Gerente/Oficial (sin acceso financiero) en Dashboard y "Para hoy":** no deben ver montos ni alertas de partidas → aserción UI con `lucia@piloto.test` en Task 10.

---

## Fase A — Errores

### Task 1: Fechas locales y legibles (E1 + base de O7)

**Files:**
- Create: `web/src/lib/fechas.ts`, `web/src/lib/fechas.test.ts`
- Modify (reemplazar `hoyISO` local por `hoyLocal`): `web/src/pages/Historial.tsx:9`, `web/src/pages/obra/AsistenciasTab.tsx:11`, `web/src/pages/obra/AvancesTab.tsx:9`, `web/src/pages/obra/RemisionesTab.tsx:16`, `web/src/pages/oficial/AsistenciaWizard.tsx:15`, `web/src/pages/oficial/EvidenciaWizard.tsx:10`

**Interfaces:**
- Produces: `hoyLocal(ahora?: Date): string` → `"YYYY-MM-DD"` local; `fechaCorta(iso: string): string` → `"lun 20 oct"`; `fechaLarga(iso: string): string` → `"lunes 20 de octubre"`; `horaLocal(ahora?: Date): string` → `"HH:mm"`. `iso` acepta `"YYYY-MM-DD"` o ISO completo (usa los primeros 10 caracteres, sin conversión de zona).

- [ ] **Step 1: Test que falla** (`web/src/lib/fechas.test.ts`):

```ts
test("hoyLocal a las 23:30 locales sigue siendo el mismo dia", () =>
  assert.equal(hoyLocal(new Date(2026, 9, 21, 23, 30)), "2026-10-21"));
test("hoyLocal rellena con ceros", () => assert.equal(hoyLocal(new Date(2026, 0, 5, 8)), "2026-01-05"));
test("fechaCorta", () => assert.equal(fechaCorta("2026-10-20"), "lun 20 oct"));
test("fechaCorta ignora la hora del ISO", () => assert.equal(fechaCorta("2026-10-20T06:00:00.000Z"), "lun 20 oct"));
test("fechaLarga", () => assert.equal(fechaLarga("2026-10-20"), "lunes 20 de octubre"));
test("horaLocal", () => assert.equal(horaLocal(new Date(2026, 9, 21, 7, 5)), "07:05"));
```

- [ ] **Step 2:** `server/node_modules/.bin/tsx --test web/src/lib/fechas.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar con arrays fijos de nombres en español (no `toLocaleDateString`, para que el resultado no dependa del navegador); construir la fecha con `new Date(y, m-1, d)`.
- [ ] **Step 4:** Reemplazar las 6 funciones `hoyISO`/`ahoraHHmm` locales por imports de `lib/fechas` (borrar las copias).
- [ ] **Step 5:** Test → PASS; ambos `tsc` limpios.
- [ ] **Step 6: Commit** `fix(fechas): hoy en hora local del dispositivo`

### Task 2: Presupuesto oficial = suma de partidas (E2)

**Files:**
- Modify: `server/src/modules/obras/obras.routes.ts:50-56` (lista), `server/src/modules/reportes/reportes.routes.ts` (hoja `costos-obra`, línea de `const presupuesto = obra.presupuestoAutorizado`)
- Modify: `web/src/lib/types.ts` (`Obra`), `web/src/pages/Dashboard.tsx:25,82`, `web/src/pages/Obras.tsx` (form: etiqueta), `web/src/pages/ObraDetail.tsx` (form editar: etiqueta)

**Interfaces:**
- Produces: `GET /obras` (roles financieros) agrega `presupuestoTotal: number` (= `resumenFinancieroObra(o.id).presupuestoTotal`); `presupuestoAutorizado` se sigue enviando.

- [ ] **Step 1:** Server lista: agregar `presupuestoTotal: resumenes![i].presupuestoTotal`.
- [ ] **Step 2:** Excel costos-obra: `const presupuesto = (await resumenFinancieroObra(obra.id)).presupuestoTotal`.
- [ ] **Step 3:** Web: Dashboard (tarjeta total y monto por obra) y cualquier otra vista de lista usan `presupuestoTotal`. Formularios de obra: etiqueta "Presupuesto autorizado por el cliente".
- [ ] **Step 4: Verificar:** smoke fetch: para cada obra, `GET /obras` `presupuestoTotal` == `GET /obras/:id` `financiero.presupuestoTotal` (Torre Norte: 257000). Agregar a `ux-check.cjs`: Dashboard muestra `$257,000` en la tarjeta de Torre Norte.
- [ ] **Step 5: Commit** `fix(presupuesto): una sola cifra oficial (suma de partidas)`

### Task 3: Alerta de partida y barra de presupuesto (E3 + C3)

**Files:**
- Modify: `server/src/lib/finance.ts`, `server/src/lib/finance.test.ts`, `server/src/modules/obras/obras.routes.ts` (lista y detalle)
- Create: `web/src/components/BarraPresupuesto.tsx`
- Modify: `web/src/lib/types.ts`, `web/src/pages/Dashboard.tsx`, `web/src/pages/Obras.tsx`, `web/src/pages/ObraDetail.tsx` (cabecera financiera)

**Interfaces:**
- Produces (server): `alertaPartida(partidas: PartidaConSaldo[]): { partidaId: string; nombre: string; porcentaje: number } | null` — la partida con mayor `porcentajeConsumido` si es ≥ 90, si no `null`; partidas con presupuesto 0 se ignoran.
- Produces (API): `GET /obras` y `GET /obras/:id` (financieros) agregan `alertaPartida` con esa forma.
- Produces (web): `<BarraPresupuesto porcentaje={number} alerta={{ nombre, porcentaje } | null} />` — barra verde <90, ámbar ≥90, roja ≥100 (el color lo decide el mayor entre `porcentaje` y `alerta.porcentaje`); debajo, si hay alerta: "⚠ {nombre} al {porcentaje}%".

- [ ] **Step 1: Tests que fallan** en `finance.test.ts`:

```ts
const p = (nombre: string, porcentajeConsumido: number, presupuesto = 100) =>
  ({ id: nombre, codigo: nombre, nombre, tipo: null, estado: "activa", presupuestoInicial: presupuesto,
     presupuestoActualizado: presupuesto, consumido: 0, disponible: 0, porcentajeConsumido });
test("alerta con la partida mas consumida >= 90", () =>
  assert.deepEqual(alertaPartida([p("GEN", 0), p("MAT", 104.3), p("MO", 92)]), { partidaId: "MAT", nombre: "MAT", porcentaje: 104 }));
test("sin alerta bajo 90", () => assert.equal(alertaPartida([p("GEN", 89.9)]), null));
test("ignora partidas con presupuesto 0", () => assert.equal(alertaPartida([p("X", 0, 0)]), null));
test("sin partidas", () => assert.equal(alertaPartida([]), null));
```

- [ ] **Step 2:** `server/node_modules/.bin/tsx --test server/src/lib/finance.test.ts` → FAIL.
- [ ] **Step 3:** Implementar (`porcentaje` redondeado con `Math.round`); exponer en las dos rutas.
- [ ] **Step 4:** `BarraPresupuesto` en cabecera de obra (en lugar de la pill "x% consumido"), tarjetas de Dashboard y lista de Obras. En la cabecera, el aviso enlaza a la pestaña Presupuesto (`?tab=presupuesto`, ver Task 10).
- [ ] **Step 5:** Tests PASS, `tsc` limpio, `ux-check`: obra Torre Norte muestra "Materiales al 104%".
- [ ] **Step 6: Commit** `feat(presupuesto): barra y alerta de partida en cabeceras y listas`

### Task 4: Preselección y bloqueo de asistencia (E4 + E5)

**Files:**
- Modify: `web/src/lib/asistencias.ts`, `web/src/lib/asistencias.test.ts`, `web/src/pages/obra/AsistenciasTab.tsx`, `web/src/pages/oficial/AsistenciaWizard.tsx`

**Interfaces:**
- Consumes: `horasRegistradasEnFecha` (existente).
- Produces: `seleccionInicial(personaId: string | null | undefined, obraPersonas: { personaId: string; activo?: boolean }[]): Set<string>` — `{personaId}` solo si aparece en `obraPersonas` (y `activo !== false`), si no vacío.

- [ ] **Step 1: Tests que fallan:**

```ts
test("preselecciona solo si esta asignado", () =>
  assert.deepEqual([...seleccionInicial("a", [{ personaId: "a" }])], ["a"]));
test("no preselecciona si no esta en la obra", () => assert.equal(seleccionInicial("a", [{ personaId: "b" }]).size, 0));
test("sin persona", () => assert.equal(seleccionInicial(null, [{ personaId: "b" }]).size, 0));
```

- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar; usarla en ambos componentes para el `useState` inicial. En `AsistenciaWizard` aplicar el mismo bloqueo visual y `aEnviar` que `AsistenciasTab` (cargar `GET /obras/:obraId/asistencias` con `fecha_desde=fecha_hasta=fecha`).
- [ ] **Step 4:** Tests PASS, `tsc`, `ux-check`: obra "Red WiFi" (sin personas) → botón muestra "(0)" y está deshabilitado.
- [ ] **Step 5: Commit** `fix(asistencias): preseleccion valida y bloqueo en asistente del oficial`

### Task 5: Navegación — Configuración (Personas, Herramientas, Empresa, Seguridad), perfil y barra inferior (E6 + C1 + O8)

**Files:**
- Modify: `web/src/components/Layout.tsx`
- Create: `web/src/components/MenuDesplegable.tsx`

**Interfaces:**
- Produces: `<MenuDesplegable etiqueta={ReactNode} items={{ label: string; to?: string; onClick?: () => void }[]} />` — botón que abre una lista; cierra con clic fuera y con `Escape`; botones de 44px mínimo; `aria-expanded`.

- [ ] **Step 1:** Barra principal (escritorio y móvil) para roles de gestión: Dashboard, Obras, Reportes (quitar Personas y Herramientas de `NAV_GESTION` y eliminar `NAV_ADMIN_EXTRA`). Oficial sin cambios (Mis obras, Herramientas = `/mis-herramientas`, Historial).
- [ ] **Step 2:** Cabecera: `MenuDesplegable` "Configuración" (icono engrane, solo roles de gestión) con "Personas" y "Herramientas" (todos los de gestión), "Empresa" y "Seguridad" (solo Administrador). El bloque nombre/rol se vuelve otro `MenuDesplegable` con "Salir"; el botón "Salir" suelto desaparece. Las rutas `/personas` y `/herramientas` no cambian; el `NavLink` activo de Configuración se marca cuando la ruta es una de las cuatro.
- [ ] **Step 3:** `tsc`; `ux-check`: móvil admin → barra inferior con 3 enlaces, sin "Personas", "Herramientas" ni "Seguridad"; menú Configuración contiene "Personas", "Herramientas", "Empresa", "Seguridad"; lucia (Gerente) → Configuración contiene "Personas" y "Herramientas" y no "Empresa"; ivan (Oficial) → sin menú Configuración, perfil contiene "Salir".
- [ ] **Step 4: Commit** `feat(nav): menu de perfil con configuracion y salir`

---

## Fase B — Oficial

### Task 6: Estado de hoy y entrada directa (O1 + O2)

**Files:**
- Modify: `server/src/modules/obras/obras.routes.ts` (GET `/`), `web/src/lib/types.ts`, `web/src/pages/MisObras.tsx`

**Interfaces:**
- Produces: `GET /obras?fecha=YYYY-MM-DD` (fecha validada con `FECHA_ISO`) agrega a cada obra `hoy: { miLlegada: string | null; avances: number; asistencias: number }`: `miLlegada` = `horaLlegada` de la asistencia del usuario (`req.user.personaId`) en esa fecha u obra, `avances` = avances no borrados de esa fecha, `asistencias` = asistencias de esa fecha. Sin `fecha` el campo no se envía.

- [ ] **Step 1:** Server: con `fecha`, dos `groupBy`/`findMany` por `obraId in ids` (asistencias y avances de `startOfDay(fecha)`), sin N+1.
- [ ] **Step 2:** `MisObras` pide `/obras?fecha=${hoyLocal()}` (queryKey `["obras", "hoy", fecha]`) y muestra en cada tarjeta dos indicadores: "✓ Llegaste 07:45" / "Asistencia pendiente" y "✓ Evidencia de hoy" / "Falta evidencia".
- [ ] **Step 3:** Si `data.length === 1`, `<Navigate to={/mis-obras/:id} replace />`. `ProcesoSelector` mantiene "← Mis obras" (que con una obra vuelve a redirigir: en ese caso ocultar el enlace).
- [ ] **Step 4:** Smoke fetch: `GET /obras?fecha=2026-10-20` como ivan → obra Torre Norte `hoy.miLlegada === "07:45"`; `fecha=2020/01/01` → 400. `ux-check` oficial: texto "Llegaste" o "Asistencia pendiente" visible en Mis obras.
- [ ] **Step 5: Commit** `feat(oficial): estado de hoy por obra y entrada directa`

### Task 7: "Registrar mi llegada" y confirmación de asistencia (O3 + O6 asistencia)

**Files:**
- Modify: `web/src/pages/oficial/ProcesoSelector.tsx`, `web/src/pages/oficial/AsistenciaWizard.tsx`
- Create: `web/src/components/Confirmacion.tsx`

**Interfaces:**
- Consumes: `hoy.miLlegada` (Task 6), `seleccionInicial` (Task 4), `horaLocal`/`hoyLocal` (Task 1).
- Produces: `<Confirmacion titulo={string} detalle={ReactNode} accion?={{ label: string; to: string }} />` — bloque "Listo ✓" grande, `role="status"`.

- [ ] **Step 1:** `ProcesoSelector`: si el usuario está en `obra.obraPersonas` (usar `seleccionInicial(...).size > 0`) y `miLlegada` es null → botón principal "Registrar mi llegada ({horaLocal()})" que hace `POST /obras/:obraId/asistencias` con solo su registro. Con `miLlegada` → "✓ Llegaste a las {miLlegada}" (deshabilitado). La tarjeta "Asistencia" pasa a texto "Registrar a otros o cambiar hora".
- [ ] **Step 2:** Tras guardar (botón rápido o asistente) mostrar `Confirmacion` con quién y hora, y `accion` "Registrar evidencia" si `hoy.avances === 0`. Invalidar `["obras", "hoy", fecha]`.
- [ ] **Step 3:** `tsc`; `ux-check` (solo lectura: no pulsar): ivan ve "Registrar mi llegada" o "Llegaste a las"; un usuario no asignado (edgar en obra Red WiFi vía `/mis-obras/:id`) no ve el botón.
- [ ] **Step 4: Commit** `feat(oficial): registrar mi llegada en un toque`

### Task 8: Evidencia en una pantalla y fecha fija (O4 + O5 + O6 evidencia)

**Files:**
- Create: `web/src/lib/evidencias.ts`, `web/src/components/FechaHoy.tsx`
- Modify: `web/src/components/EvidenceUploader.tsx` (usar `subirArchivos`), `web/src/pages/oficial/EvidenciaWizard.tsx`, `web/src/pages/oficial/AsistenciaWizard.tsx`

**Interfaces:**
- Produces: `subirArchivos(entidadTipo: string, entidadId: string, files: File[], onProgreso?: (actual: number, total: number) => void): Promise<string[]>` — sube en secuencia a `POST /evidencias`, devuelve los mensajes de error por archivo (`"nombre: motivo"`), no lanza. `EvidenceUploader.subirVarios` pasa a usarla.
- Produces: `<FechaHoy value={string} onChange={(v: string) => void} />` — muestra "Hoy, {fechaLarga}" (o la fecha elegida) y un enlace "cambiar fecha" que revela el `<Input type="date" max={hoyLocal()}>`.

- [ ] **Step 1:** `EvidenciaWizard` en una sola pantalla: arriba selector de fotos (Cámara/Galería con `multiple`, miniaturas locales con `URL.createObjectURL`, botón quitar), abajo descripción y `FechaHoy`. "Guardar" valida descripción no vacía **antes** de cualquier request (si falta, mensaje y fotos intactas); luego crea el avance y llama `subirArchivos`. Al terminar, `Confirmacion` con nº de fotos subidas y errores si hubo.
- [ ] **Step 2:** `AsistenciaWizard` usa `FechaHoy`.
- [ ] **Step 3:** `tsc`; `ux-check` oficial en `/mis-obras/:id/evidencia`: existe texto "Hoy," y los botones de foto están **antes** del textarea en el DOM; pulsar "Guardar" con descripción vacía muestra el mensaje y no navega (sin fotos elegidas, no crea nada).
- [ ] **Step 4: Commit** `feat(oficial): evidencia en una pantalla con fotos primero`

### Task 9: Fechas legibles en pantallas (O7)

**Files:**
- Modify: toda vista con `.slice(0, 10)` mostrada al usuario: `web/src/pages/Historial.tsx`, `MisHerramientas.tsx`, `Herramientas.tsx`, `obra/AsistenciasTab.tsx`, `obra/AvancesTab.tsx`, `obra/RemisionesTab.tsx`, `Dashboard.tsx` (texto de alertas viene del server: ver Step 2)

**Interfaces:** Consumes `fechaCorta` (Task 1).

- [ ] **Step 1:** Reemplazar las fechas visibles `YYYY-MM-DD` por `fechaCorta(...)` (los `value` de inputs se quedan en ISO).
- [ ] **Step 2:** Las alertas de evidencia sin foto (texto armado en server) se dejan; Task 10 las re-renderiza desde datos estructurados.
- [ ] **Step 3:** `tsc`; `ux-check`: en Historial del oficial no aparece ningún texto que case `/\d{4}-\d{2}-\d{2}/`.
- [ ] **Step 4: Commit** `feat(ui): fechas legibles`

---

## Fase C — Admin y accesibilidad

### Task 10: Dashboard "Para hoy" y enlaces a pestañas (C2)

**Files:**
- Modify: `web/src/pages/Dashboard.tsx`, `web/src/pages/ObraDetail.tsx` (pestaña inicial desde `?tab=`), `server/src/modules/notificaciones/notificaciones.routes.ts` (si la alerta no trae `obraId` y `fecha` estructurados)

**Interfaces:**
- Consumes: `GET /obras?fecha=` (`hoy.asistencias`, Task 6), `alertaPartida` (Task 3).
- Produces: `ObraDetail` acepta `?tab=<TabKey>` como pestaña inicial (si no es visible para el rol, cae a "resumen").

- [ ] **Step 1:** Bloque "Para hoy" arriba con 3 contadores clicables: obras `en_ejecucion` con `hoy.asistencias === 0` (→ `/obras/:id?tab=asistencias`, si es una; si son varias, lista desplegable), evidencias sin foto de los últimos 7 días (→ `?tab=avances`), partidas ≥ 90% (→ `?tab=presupuesto`; **solo** si `puedeVerFinanciero`).
- [ ] **Step 2:** Las alertas existentes se muestran como enlaces a su obra/pestaña.
- [ ] **Step 3:** `tsc`; `ux-check`: edgar ve "Para hoy" y al hacer clic en el contador de partidas llega a `?tab=presupuesto` con la pestaña activa; lucia (Gerente) no ve el contador de partidas ni montos.
- [ ] **Step 4: Commit** `feat(dashboard): bloque para hoy con accesos directos`

### Task 11: Resumen de obra útil (C4)

**Files:** Modify `web/src/pages/ObraDetail.tsx` (`ResumenTab`)

- [ ] **Step 1:** El Resumen muestra, en este orden: "Hoy" (quién llegó: asistencias de `hoyLocal()` de la obra), "Última evidencia" (fecha corta, texto truncado a 2 líneas, nº de fotos), alerta de partida (Task 3) y la lista de partidas con `BarraPresupuesto` (solo financieros).
- [ ] **Step 2:** `tsc`; `ux-check`: Torre Norte → Resumen contiene "Última evidencia".
- [ ] **Step 3: Commit** `feat(obra): resumen con hoy y ultima evidencia`

### Task 12: Asistencias por día y fotos plegadas (C5 + C12)

**Files:**
- Modify: `web/src/lib/asistencias.ts`, `web/src/lib/asistencias.test.ts`, `web/src/pages/obra/AsistenciasTab.tsx`, `web/src/components/EvidenceUploader.tsx`, `web/src/pages/obra/AvancesTab.tsx`, `web/src/pages/obra/RemisionesTab.tsx`

**Interfaces:**
- Produces: `agruparPorDia<T extends { fecha: string; transaccion?: { monto: number } | null }>(asistencias: T[]): { fecha: string; items: T[]; costo: number }[]` — orden descendente por fecha (`fecha.slice(0,10)`), `costo` = suma de `transaccion.monto`.
- Produces: `EvidenceUploader` prop `plegado?: boolean` — muestra "📎 Fotos ({n})" y despliega el contenido actual al tocar.

- [ ] **Step 1: Test que falla:**

```ts
test("agrupa por dia, mas reciente primero, con costo", () => {
  const g = agruparPorDia([
    { fecha: "2026-10-19T06:00:00.000Z", transaccion: { monto: 550 } },
    { fecha: "2026-10-20T06:00:00.000Z", transaccion: { monto: 650 } },
    { fecha: "2026-10-20T06:00:00.000Z", transaccion: null },
  ]);
  assert.deepEqual(g.map((d) => [d.fecha, d.items.length, d.costo]), [["2026-10-20", 2, 650], ["2026-10-19", 1, 550]]);
});
```

- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Historial de asistencias: grupos "lun 20 oct · 3 personas · $1,780" (monto solo si `verFinanciero`), solo el más reciente abierto, 7 grupos y botón "Ver días anteriores" (+7). Dentro, filas con editar/eliminar y `EvidenceUploader plegado`.
- [ ] **Step 4:** Usar `plegado` también en tarjetas de Evidencias y Remisiones.
- [ ] **Step 5:** `tsc`; `ux-check`: Torre Norte → Asistencias muestra un encabezado que contiene "personas" y como máximo 7 grupos.
- [ ] **Step 6: Commit** `feat(asistencias): historial agrupado por dia y fotos plegadas`

### Task 13: Transacciones con fecha, filtros y total (C6)

**Files:**
- Create: `web/src/lib/transacciones.ts`, `web/src/lib/transacciones.test.ts`
- Modify: `web/src/pages/obra/TransaccionesTab.tsx`, `web/src/lib/types.ts` (`Transaccion.asistencia`, `Transaccion.remision` opcionales, ya vienen del server)

**Interfaces:**
- Produces: `fechaTransaccion(t: { createdAt: string; asistencia?: { fecha: string } | null; remision?: { fecha: string } | null }): string` (`YYYY-MM-DD`); `GRUPOS_TIPO: Record<"mano_obra" | "material" | "bonos" | "presupuesto" | "otros", string[]>`; `grupoDeTipo(tipo: string): keyof typeof GRUPOS_TIPO`.

- [ ] **Step 1: Tests que fallan:**

```ts
test("fecha de la asistencia", () =>
  assert.equal(fechaTransaccion({ createdAt: "2026-10-22T01:00:00Z", asistencia: { fecha: "2026-10-20T06:00:00Z" } }), "2026-10-20"));
test("fecha de la remision", () =>
  assert.equal(fechaTransaccion({ createdAt: "2026-10-22T01:00:00Z", remision: { fecha: "2026-10-19T00:00:00Z" } }), "2026-10-19"));
test("sin vinculo usa createdAt", () => assert.equal(fechaTransaccion({ createdAt: "2026-10-21T15:00:00Z" }), "2026-10-21"));
test("grupos", () => {
  assert.equal(grupoDeTipo("bono"), "bonos");
  assert.equal(grupoDeTipo("comision"), "bonos");
  assert.equal(grupoDeTipo("ajuste_presupuesto"), "presupuesto");
  assert.equal(grupoDeTipo("devolucion"), "otros");
});
```

- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Pestaña: chips de filtro (Todos, Mano de obra, Material, Bonos/comisiones, Presupuesto, Otros), total del filtro arriba (suma de `montoConSigno`), `fechaCorta(fechaTransaccion(t))` en cada tarjeta, orden por esa fecha descendente.
- [ ] **Step 4:** `tsc`; `ux-check`: al pulsar "Bonos/comisiones" solo quedan tarjetas "Bono"/"Comisión".
- [ ] **Step 5: Commit** `feat(transacciones): fecha, filtros por tipo y total`

### Task 14: Evidencias con historial primero (C7)

**Files:** Modify `web/src/pages/obra/AvancesTab.tsx`

- [ ] **Step 1:** Orden: encabezado de sección con botones "+ Registrar evidencia" (abre el formulario existente arriba de la lista), "Descargar reporte PDF" (abre un pequeño panel con Desde/Hasta y el botón actual) y "Descargar todas las fotos"; después el historial.
- [ ] **Step 2:** `tsc`; `ux-check`: el primer elemento tras las pestañas es el encabezado con "+ Registrar evidencia"; el textarea no es visible hasta pulsarlo.
- [ ] **Step 3: Commit** `feat(evidencias): historial primero y acciones en encabezado`

### Task 15: Personas con filtro y obras (C8)

**Files:** Modify `server/src/modules/personas/personas.routes.ts` (GET `/`), `web/src/lib/types.ts`, `web/src/pages/Personas.tsx`

**Interfaces:**
- Produces: `GET /personas` agrega `obras: { id: string; nombre: string }[]` (asignaciones `activo: true` a obras no borradas y no `cerrada`/`cancelada`).

- [ ] **Step 1:** Server: `include: { obraPersonas: { where: { activo: true, obra: { deletedAt: null, estado: { notIn: ["cerrada", "cancelada"] } } }, include: { obra: { select: { id: true, nombre: true } } } } }` y mapear a `obras`.
- [ ] **Step 2:** Web: buscador (`coincideBusqueda` sobre nombre y puesto), chips Todos/Campo/Oficina por `tipoTrabajador`, y en cada tarjeta "Obras: A, B" o "Sin obra asignada".
- [ ] **Step 3:** `tsc`; `ux-check` (entrando por Configuración → Personas): filtro "Campo" oculta a "Edgar Ramirez"; la tarjeta de Ivan muestra "Cableado".
- [ ] **Step 4: Commit** `feat(personas): filtro, buscador y obras asignadas`

### Task 16: Valores crudos y pills legibles (C9 + D2)

**Files:**
- Create: `web/src/lib/etiquetas.ts`, `web/src/lib/etiquetas.test.ts`
- Modify: `web/src/components/ui.tsx` (`Pill`), `web/src/pages/Obras.tsx` (quitar su `ESTADOS` local), `web/src/pages/obra/PresupuestoTab.tsx:41`, `web/src/pages/MisObras.tsx`, y demás usos de `estado` / `tipo` crudos

**Interfaces:**
- Produces: `etiquetaEstadoObra(estado: string): string`, `etiquetaTipoPartida(tipo: string | null): string` (`mano_obra`→"Mano de obra", `material`→"Material", `general`→"General", null→"Otro"), `etiquetaEstadoHerramienta(estado: string): string`. Valor desconocido → se devuelve con la primera letra en mayúscula y `_` como espacio.

- [ ] **Step 1: Tests que fallan:**

```ts
test("estado obra", () => assert.equal(etiquetaEstadoObra("en_ejecucion"), "En ejecución"));
test("tipo partida", () => assert.equal(etiquetaTipoPartida("mano_obra"), "Mano de obra"));
test("desconocido legible", () => assert.equal(etiquetaEstadoObra("en_revision"), "En revision"));
```

- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** `Pill`: quitar `uppercase`/`font-mono`/`tracking-*`; texto normal 13px. Usar las etiquetas en todas las vistas.
- [ ] **Step 4:** `tsc`; `ux-check`: ninguna pantalla recorrida contiene `mano_obra`, `en_ejecucion` ni `EN EJECUCION`.
- [ ] **Step 5: Commit** `feat(ui): etiquetas legibles y pills sin mayusculas`

### Task 17: Reportes explicados (C10)

**Files:** Modify `web/src/pages/Reportes.tsx`

- [ ] **Step 1:** `TODOS_LOS_TIPOS` gana `descripcion` y `paraQuien` (texto fijo por reporte). La pantalla muestra una tarjeta por reporte visible para el rol (mismo filtro `TIPOS_FINANCIEROS`) con su descripción; al elegir una, se despliegan los filtros actuales y "Exportar a Excel". Filtros y descarga no cambian.
- [ ] **Step 2:** `tsc`; `ux-check`: edgar ve 9 tarjetas; lucia ve solo las no financieras (5).
- [ ] **Step 3: Commit** `feat(reportes): tarjetas con descripcion de cada reporte`

### Task 18: Avisos de "Guardado ✓" (C11)

**Files:**
- Create: `web/src/components/Aviso.tsx` (proveedor + hook)
- Modify: `web/src/App.tsx` (montar proveedor), y el `onSuccess` de cada formulario de crear/editar en: `Herramientas.tsx`, `Personas.tsx`, `Obras.tsx`, `ObraDetail.tsx`, `Empresa.tsx`, `Seguridad.tsx`, `obra/*.tsx`

**Interfaces:**
- Produces: `<AvisoProvider>` y `useAviso(): (texto: string) => void` — muestra un aviso fijo abajo (encima de la barra móvil) 3 s, `role="status"`, uno a la vez.

- [ ] **Step 1:** Implementar y llamar `aviso("Guardado ✓")` (o texto específico: "Herramienta asignada ✓", "Asistencia eliminada") en cada `onSuccess`.
- [ ] **Step 2:** `tsc`; verificación manual en la app: editar el nombre de una herramienta muestra el aviso (no se agrega a `ux-check` porque guarda datos).
- [ ] **Step 3: Commit** `feat(ui): avisos de guardado`

### Task 19: Legibilidad y toques seguros (D1 + D3)

**Files:**
- Modify: `web/tailwind.config.js` (color `ink-soft`), `web/src/components/ui.tsx`, tarjetas con acciones: `obra/AsistenciasTab.tsx`, `Herramientas.tsx`, `obra/TransaccionesTab.tsx`, `obra/PresupuestoTab.tsx`, `Personas.tsx`, `Seguridad.tsx`
- Reuse: `MenuDesplegable` (Task 5)

- [ ] **Step 1:** Medir contraste de `ink-soft` sobre `#FFFFFF` y `#F1EEE7`; oscurecer hasta ≥ 4.5:1 en ambos (anotar el valor y la razón medida en el commit). Reemplazar `text-[10px]`/`text-[11px]`/`text-xs` en texto informativo por `text-[13px]` mínimo.
- [ ] **Step 2:** Acciones de tarjeta con área ≥ 44×44px en móvil; "Eliminar" (asistencias) y acciones destructivas pasan a un `MenuDesplegable` "⋯" conservando su `confirm`.
- [ ] **Step 3:** `tsc`; `ux-check` móvil: ningún botón visible dentro de `main` mide menos de 44px de alto.
- [ ] **Step 4: Commit** `feat(a11y): contraste, tamanos y menu de acciones`

---

## Fase E — Maqueta de pestañas (aprobación)

### Task 20: Maqueta navegable Hoy / Bitácora / Equipo / Dinero

**Files:** Create (scratchpad, no en el repo): `maqueta-pestanas.html`, publicado como Artifact privado.

- [ ] **Step 1:** Cargar el skill `artifact-design` y hacer `quickstart`.
- [ ] **Step 2:** Página única que reproduce la cabecera de obra (Torre Norte, con datos reales tomados de `GET /obras/:id`) y 4 pestañas con el contenido del spec, Parte E; vista móvil y escritorio; cada bloque marca de qué pestaña actual viene.
- [ ] **Step 3:** Publicar y pedir aprobación al usuario. **La construcción real de las pestañas no entra en este plan**: con la maqueta aprobada se escribe un plan aparte.

---

## Cierre

- [ ] Correr todas las pruebas `*.test.ts` de `server/src/lib` y `web/src/lib`, ambos `tsc`, `ux-check.cjs` completo y el smoke de ajustes anterior (`smoke.mjs`, `smoke-fixes.mjs`, `smoke-menores.mjs` contra copia de `dev.db`) para descartar regresiones.
- [ ] Revisión final de la rama con un revisor nuevo (superpowers:requesting-code-review), incluyendo la Review Focus.
