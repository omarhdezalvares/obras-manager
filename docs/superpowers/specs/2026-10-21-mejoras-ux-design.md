# Mejoras de UX de Bitácora — Diseño

**Fecha:** 2026-10-21 · **Origen:** recorrido UX del 2026-10-21 (24 capturas, admin escritorio/móvil y oficial móvil).

## Intención

El usuario siente que la app "no es muy intuitiva". El recorrido confirmó por qué:
- El **oficial** tiene un flujo bueno pero no sabe qué le falta hoy, la fecha puede salir mal y hay pasos de más.
- El **admin** navega por la estructura de la base de datos (8 pestañas, listas planas, jerga técnica) en vez de por su trabajo diario ("¿cómo va la obra?", "¿qué tengo que resolver?").

Meta: que cada rol entienda en segundos qué pasa y qué le toca hacer, con menos toques y sin números que se contradigan.

## Metas

1. Corregir los errores E1–E6 que generan desconfianza.
2. Oficial: saber qué le falta hoy, registrar su llegada en un toque, confirmación clara al guardar.
3. Admin: Dashboard que diga qué resolver, listas agrupadas y resumidas, lenguaje de obra en vez de jerga contable/técnica.
4. Reorganizar las pestañas de la obra **solo después** de aprobar una maqueta.

## No-metas

- No cambiar reglas de negocio (permisos por rol, cálculo de costos, auditoría).
- No rediseñar la identidad visual (colores, tipografía base, logo de la app).
- No agregar módulos nuevos (nómina, inventario, app nativa).
- No recorrer/ajustar Supervisor, Gerente, Finanzas y Solo lectura más allá de lo que hereden de "admin" (comparten pantallas).

## Anti-metas (sería un fracaso aunque funcione)

- Que el oficial necesite **más** toques que hoy para registrar asistencia o evidencia.
- Que algún número de dinero cambie de valor (solo puede cambiar *dónde* o *cómo* se muestra).
- Que se pierda una función existente (editar, eliminar, PDF, fotos, Excel) al reorganizar.
- Que la pantalla del oficial muestre información financiera.

## Restricciones

- Stack existente: React 18 + React Query + Tailwind (web), Express + Prisma/SQLite (server). Sin dependencias nuevas salvo que una tarea lo justifique explícitamente.
- Mobile-first para el oficial (viewport 390px); admin usable en escritorio y en celular.
- Zona horaria de operación: México (UTC-6). "Hoy" siempre es la fecha local del dispositivo.
- Rama nueva `mejoras-ux` creada desde `ajustes-bitacora` (todavía no integrada a `main`; el repo git es `C:\PROYECTOS\BITACORA\obras-manager`), un commit por tarea, pruebas como en la rama anterior (`node:test` vía `tsx --test` para lógica pura, smoke Playwright/fetch contra copia de `dev.db`).

---

## Parte A — Errores (prioridad 1)

| ID | Problema | Comportamiento esperado |
|---|---|---|
| E1 | `hoyISO()` usa UTC (`toISOString`): después de las 18:00 en México "hoy" es mañana. Aparece en 6 archivos (Historial, AsistenciasTab, AvancesTab, RemisionesTab, AsistenciaWizard, EvidenciaWizard). | Una única función `hoyLocal()` en `web/src/lib/fechas.ts` con fecha local; todos la usan. A las 23:30 del 21-oct devuelve `2026-10-21`. El server ya guarda `Asistencia.fecha`/`Avance.fecha` con `startOfDay` (medianoche local del server) a partir del `YYYY-MM-DD` que manda el cliente, así que basta corregir el front. Los registros ya guardados con fecha corrida no se pueden distinguir de los capturados a propósito: **no se migran**. |
| E2 | Dashboard suma `presupuestoAutorizado`; el detalle de obra suma partidas. Misma obra: $180,000 vs $257,000. | **Número oficial: la suma de partidas** (`resumenFinancieroObra().presupuestoTotal`) — *decisión del usuario*. Lo usan Dashboard (total y por obra), lista de Obras, cabecera de obra y el Excel "Costos por obra" (su "% del presupuesto" pasa a calcularse sobre la suma de partidas; es la única cifra que cambia de valor y es la corrección pedida, no una violación de la anti-meta). `presupuestoAutorizado` se conserva en los formularios de crear/editar obra como dato informativo con la etiqueta "Presupuesto autorizado por el cliente"; al crear la obra sigue sembrando la partida General como hoy. |
| E3 | Cabecera de obra dice "7% consumido" en verde aunque una partida va al 104%. | La cabecera muestra además un aviso cuando alguna partida ≥ 90% ("Materiales al 104%") en ámbar (≥90) o rojo (≥100), con enlace a Presupuesto. Igual en la tarjeta de la obra en Dashboard. |
| E4 | "Guardar asistencia (1)" con nadie seleccionado: cuenta al usuario preseleccionado aunque no esté asignado a la obra. | La preselección solo incluye al usuario si es una persona activa asignada a esa obra; el contador nunca cuenta a alguien que no aparece en la lista. |
| E5 | El asistente de asistencia del oficial no bloquea personas ya registradas ese día. | Mismo bloqueo que la pestaña admin (reusar `horasRegistradasEnFecha`): fila deshabilitada con "Ya registrada (llegada HH:mm)". |
| E6 | Barra inferior del admin en celular con 7 botones; las etiquetas se enciman. | Máximo 5 accesos en la barra inferior; Empresa y Seguridad pasan a un menú "Más/Configuración" (ver B-Admin-1). |

## Parte B — Mejoras del Oficial (prioridad 2)

| ID | Mejora | Criterio de aceptación |
|---|---|---|
| O1 | **Estado de hoy por obra** en "Mis obras". | Cada tarjeta muestra dos indicadores para hoy: "Asistencia ✓/pendiente" = **el propio oficial** tiene asistencia hoy en esa obra; "Evidencia ✓/pendiente" = existe **un avance de hoy en esa obra, de cualquier persona** (la evidencia es del equipo; sus fotos no cuentan aquí — eso lo vigila C2). *(Mi decisión.)* "Hoy" lo manda el cliente como `fecha=YYYY-MM-DD` (ver Convención de "hoy"). |
| O2 | **Entrada directa con una sola obra.** | Si el oficial tiene exactamente 1 obra, `/mis-obras` lo lleva directo al selector de proceso de esa obra (con "← Mis obras" visible). |
| O3 | **"Registrar mi llegada" en un toque.** | Solo se muestra si el usuario es una persona activa asignada a la obra (misma regla que E4); si no, no aparece. La asistencia propia genera el mismo costo de mano de obra que cualquier asistencia (sin cambio de regla). En el selector de proceso, si el oficial no tiene asistencia hoy en esa obra, botón principal "Registrar mi llegada (HH:mm)" que registra solo su asistencia con la hora actual y muestra confirmación. La tarjeta "Asistencia" actual queda como "Registrar a otros / cambiar hora". Si ya registró, el botón se convierte en "✓ Llegaste a las HH:mm". |
| O4 | **Fecha fija en hoy.** | En ambos asistentes la fecha se muestra como texto ("Hoy, martes 21 oct") con un enlace "cambiar fecha" que revela el calendario. |
| O5 | **Evidencia en una pantalla, foto primero.** | El asistente de evidencia pide fotos y descripción en la misma pantalla (fotos arriba). Guardar crea el avance y sube las fotos. Debe seguir permitiendo varias fotos y no perder fotos si la descripción falta (validar antes de subir). |
| O6 | **Confirmación clara al guardar.** | Al guardar asistencia o evidencia, pantalla/estado "Listo ✓" con resumen (quién, hora, nº de fotos) y la acción siguiente sugerida ("Registrar evidencia" si falta). |
| O7 | **Fechas legibles en toda la app.** | Helper `fechaCorta("2026-10-20")` → "lun 20 oct"; `fechaLarga` → "lunes 20 de octubre". Reemplaza `YYYY-MM-DD` visibles en pantallas (no en Excel/PDF, que ya tienen su formato). |
| O8 | **"Salir" fuera del alcance accidental.** | "Salir" pasa a un menú de perfil (nombre del usuario → menú con "Salir"). Aplica a todos los roles. |

## Parte C — Mejoras del Admin (prioridad 3)

| ID | Mejora | Criterio de aceptación |
|---|---|---|
| C1 | **Menú Configuración.** | Los catálogos maestros salen de la barra principal a un menú "Configuración" (icono engrane) en la cabecera, en escritorio y en celular: **Personas** y **Herramientas** (*decisión del usuario*; visibles para los mismos roles que hoy las ven en la barra), Empresa y Seguridad (solo Administrador). La barra queda en Dashboard, Obras y Reportes. El oficial conserva su acceso "Herramientas" (Mis herramientas), que no es el catálogo. Resuelve E6. |
| C2 | **Dashboard accionable.** | Bloque "Para hoy" arriba con contadores clicables: obras activas sin asistencia hoy, evidencias sin foto (últimos 7 días), partidas ≥ 90%. Cada uno navega a la obra/pestaña correspondiente. Las alertas existentes se vuelven enlaces. |
| C3 | **Avance visual de presupuesto.** | La pill "0% consumido" se reemplaza por barra de progreso con color por umbral (verde < 90, ámbar ≥ 90, rojo ≥ 100) en Dashboard, lista de Obras y cabecera de obra. |
| C4 | **Resumen de obra útil.** | La pestaña Resumen muestra: asistencia de hoy (quién llegó), última evidencia (fecha, texto, nº fotos), alertas de la obra (E3) y partidas con barra. |
| C5 | **Asistencias agrupadas por día.** | El historial de la pestaña Asistencias se agrupa por fecha: "lun 20 oct · 3 personas · $1,780" (costo solo para roles financieros); al abrir un día muestra personas con editar/eliminar y fotos. Se muestran los 7 días más recientes con registro, **solo el más reciente abierto**; botón "Ver días anteriores" agrega 7 más. Es solo de front (el endpoint ya devuelve todo el historial). *(Mi decisión.)* |
| C6 | **Transacciones con fecha, filtros y total.** | Cada transacción muestra su fecha: la de su asistencia (`asistencia.fecha`) o remisión (`remision.fecha`) si tiene, si no `createdAt`. Sin migración; el endpoint ya incluye `asistencia` y `remision`. *(Mi decisión.)* Filtros por tipo (Mano de obra, Material, Bonos/comisiones, Ajustes/presupuesto, Otros); total del filtro arriba. |
| C7 | **Evidencias: historial primero.** | La pestaña Evidencias muestra primero el historial con botón "+ Registrar evidencia" que abre el formulario; "Descargar reporte PDF" y "Descargar todas las fotos" pasan a botones en la cabecera de la sección. |
| C8 | **Personas con filtro y obra actual.** | Filtro Campo/Oficina, buscador (reusar `coincideBusqueda`) y, en cada tarjeta, las obras activas donde está asignada. |
| C9 | **Sin valores crudos en pantalla.** | Los nombres de la app **no cambian** (Partida, Transacciones, etc. — *decisión del usuario*). Solo se reemplazan valores internos que hoy se ven tal cual: `Tipo: mano_obra` → "Tipo: Mano de obra", estados `en_ejecucion`/`PLANEADA` → "En ejecución"/"Planeada", con un mapa de etiquetas único en `web/src/lib/etiquetas.ts`. |
| C10 | **Reportes explicados.** | La pantalla Reportes muestra una tarjeta por reporte con qué trae y para quién sirve, sus filtros y botón de descarga. |
| C11 | **Confirmaciones al guardar.** | Un componente de aviso breve ("Guardado ✓") reutilizable; todos los formularios de crear/editar lo muestran al terminar. |
| C12 | **Fotos discretas en tarjetas.** | En listas (asistencias, evidencias, remisiones) las fotos se muestran como "📎 Fotos (n)" que despliega el `EvidenceUploader`; las miniaturas existentes se ven al desplegar. |

## Parte D — Accesibilidad (transversal)

| ID | Mejora | Criterio |
|---|---|---|
| D1 | Texto secundario legible. | Ningún texto informativo < 13px; el gris secundario con contraste ≥ 4.5:1 sobre su fondo (medido). |
| D2 | Pills legibles. | Estados en minúscula normal con capitalización ("En ejecución", "Sin fotos"), sin monoespaciado. |
| D3 | Toques seguros. | Botones de acción en tarjetas con área ≥ 44×44px en celular; "Eliminar" dentro de un menú "⋯" con confirmación (ya existe el confirm). |

## Parte E — Reorganización de pestañas de la obra (maqueta primero)

Propuesta a validar con maqueta navegable **antes** de construir:

| Pestaña nueva | Contiene (de las actuales) |
|---|---|
| **Hoy** | Resumen (C4) + registrar asistencia + registrar evidencia del día |
| **Bitácora** | Historial de Asistencias (C5) + historial de Evidencias (C7) + PDF/fotos |
| **Equipo** | Personas + Herramientas de la obra |
| **Dinero** | Presupuesto (partidas) + Transacciones (C6) + Remisiones + Bonos/comisiones (solo roles financieros/remisiones según permisos actuales) |

Entregable de esta parte en la fase 1: **maqueta HTML navegable** (artifact privado) con las 4 pestañas usando datos de ejemplo de Torre Norte, para aprobación. La construcción real es un plan posterior, condicionado a la aprobación. *(El nombre "Bitácora" para la segunda pestaña es mío; el reporte original decía "Reporte".)*

---

## Convención de "hoy"

Todo cálculo de "hoy" que haga el server (O1, C2, C4) usa una fecha `YYYY-MM-DD` enviada por el cliente con `hoyLocal()`, convertida con `startOfDay` igual que al guardar. El server nunca deduce "hoy" por su cuenta. *(Mi decisión.)*

## Decisiones

- **Del usuario:** Personas y Herramientas son catálogos maestros y van en Configuración (C1); número oficial de presupuesto = suma de partidas (E2); no se renombran términos (C9); la reorganización de pestañas se valida con maqueta antes de construir (E).
- **Mías (revisables):** E2 conserva `presupuestoAutorizado` como dato informativo; E1 sin migración de datos; O1 "evidencia de hoy" = avance de cualquier persona; O3 oculto si no está asignado y con costo normal; C5 7 días con el más reciente abierto; C6 fecha según asistencia/remisión; "hoy" lo manda el cliente; nombre "Bitácora" para la 2ª pestaña de E; rama desde `ajustes-bitacora`.

## Lo que se deja al constructor

- Estructura de componentes, nombres de archivos y hooks, siempre siguiendo los patrones actuales (`ui.tsx`, React Query, `api`).
- Forma exacta de los endpoints nuevos para O1/C2/C4 (preferir extender respuestas existentes sobre endpoints nuevos).
- Copys finales de botones/avisos dentro del tono actual (tuteo, frases cortas).
- Orden interno de tareas dentro de cada prioridad.

## Orden de entrega

1. Parte A (errores) — independiente, se puede integrar sola.
2. Parte B (oficial).
3. Partes C y D (admin + accesibilidad).
4. Parte E: maqueta para aprobación (puede hacerse en paralelo a 2–3); construcción en un plan posterior.
