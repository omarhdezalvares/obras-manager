# Landing con el idioma del giro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajustar la landing pública para que abra con el grupo de WhatsApp de obra, nombre los giros y lleve cada problema a su pantalla de la demo, sin quitar nada de lo que ya existe.

**Architecture:** Todo vive en `web/src/pages/Landing.tsx` y `LandingDemo.tsx` (React + Tailwind, sin router nuevo). La portada maneja una pequeña máquina de fases por tiempo (mensajes → tablero). La pestaña pedida a la demo viaja como prop desde `Landing`. La única lógica pura nueva (`whatsappUrl`) va en `web/src/lib/` con su prueba `node:test`.

**Tech Stack:** React 18, Tailwind 3, Vite 5, TypeScript; pruebas `node:test` con `npx tsx --test` (sin dependencias nuevas).

**Spec:** `docs/superpowers/specs/2026-11-25-landing-giro-design.md`

## Global Constraints

- Sin dependencias nuevas.
- Nada existente se quita: íconos, gráfica `Fuga`, `DiaDeObra`, demo, planes.
- Sin mascota ni avatar.
- 360 px de ancho sin scroll horizontal de la página.
- `prefers-reduced-motion: reduce` → sin animaciones; todo en su estado final.
- Íconos nuevos en `Landing.tsx` con `trazoIcono` (mismo trazo que `IconCaja`, etc.).
- Copy exacto de la portada: H1 "Tu obra no cabe en un grupo de WhatsApp."; subtítulo "Asistencia, avances con foto, material y herramienta de tus cuadrillas, al día y en el celular."; línea "Para construcción y servicios en campo."
- Rama `saas/landing-giro` (ya creada desde `dev`); un commit por tarea; push solo a `dev`.
- Verificación de UI: `cd web && npm run build` (tsc + vite) y captura con playwright-core (Chromium en `%LOCALAPPDATA%/ms-playwright/chromium-1243/chrome-win64/chrome.exe`) a 360 y 1364 px contra `npm run dev`.

## Review Focus

1. Recargar la página con la portada a medio animar o volver con "atrás": sin parpadeos ni el tablero atorado a medias; al desmontar se limpian los timers.
2. Pulsar "Verlo en la demo" dos veces seguidas en el mismo problema, o tras cambiar de pestaña a mano: vuelve a abrir la pestaña pedida.
3. `VITE_WHATSAPP` vacía, con espacios, con `+` o guiones: sin número válido no se dibuja el botón; con formato humano se normaliza a dígitos.
4. Celular de 360 px: chat + tablero no tapan el texto ni los botones de la portada y la franja de giros no provoca scroll horizontal.
5. Lector de pantalla: el chat decorativo no se lee tres veces; el tablero conserva su `figcaption`; los enlaces "Verlo en la demo" dicen a qué pestaña llevan.

---

### Task 1: Enlace de WhatsApp (lógica pura)

**Files:**
- Create: `web/src/lib/whatsapp.ts`
- Test: `web/src/lib/whatsapp.test.ts`

**Interfaces:**
- Produces: `whatsappUrl(numero: string | undefined, mensaje: string): string | null`

- [ ] **Step 1: Write the failing test** (`node:test` + `node:assert/strict`, como `busqueda.test.ts`)
  - `whatsappUrl(undefined, "x") === null`; `whatsappUrl("", "x") === null`; `whatsappUrl("  ", "x") === null`
  - `whatsappUrl("abc", "x") === null`; `whatsappUrl("12345", "x") === null` (menos de 10 dígitos)
  - `whatsappUrl("+52 33 1234-5678", "Hola, quiero conocer Bitácora para mi empresa.") === "https://wa.me/523312345678?text=Hola%2C%20quiero%20conocer%20Bit%C3%A1cora%20para%20mi%20empresa."`
- [ ] **Step 2:** `cd server && npx tsx --test ../web/src/lib/whatsapp.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar en `whatsapp.ts`: quitar todo lo que no sea dígito; `null` si quedan menos de 10; si no, `https://wa.me/<dígitos>?text=<encodeURIComponent(mensaje)>`.
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5:** Commit `feat(landing): enlace de WhatsApp desde VITE_WHATSAPP`.

### Task 2: La demo abre la pestaña pedida

**Files:**
- Modify: `web/src/pages/LandingDemo.tsx` (`Demo`, líneas 41-105)
- Modify: `web/src/pages/Landing.tsx` (`Landing`, líneas 15-45)

**Interfaces:**
- Produces: `type PestanaId = "tablero" | "presupuesto" | "asistencia" | "avances" | "herramientas" | "reportes"` exportado de `LandingDemo.tsx`; `Demo({ pedida }: { pedida?: { id: PestanaId } | null })`.
- Produces: en `Landing`, `const [pedida, setPedida] = useState<{ id: PestanaId } | null>(null)`; se pasa `setPedida`-wrapper `ver(id: PestanaId)` a `Problema` (Task 3) y `pedida` a `Demo`.

- [ ] **Step 1:** Tipar `PESTANAS[].id` como `PestanaId`.
- [ ] **Step 2:** En `Demo`, `useEffect` sobre `pedida`: si existe, `elegir(índice de pedida.id)` (deja `manual = true`, deja de rotar). Cada clic crea un objeto nuevo, así el mismo id pedido dos veces vuelve a disparar (Review Focus 2).
- [ ] **Step 3:** `cd web && npm run build` → sin errores.
- [ ] **Step 4:** Commit `feat(landing): la demo abre la pestaña pedida`.

### Task 3: "Así se va el dinero" con preguntas del dueño

**Files:**
- Modify: `web/src/pages/Landing.tsx` (`PROBLEMAS` 185-206, `Problema` 208-232)

**Interfaces:**
- Consumes: `PestanaId`, `ver(id)` de Task 2.
- Produces: `Problema({ ver }: { ver: (id: PestanaId) => void })`; `PROBLEMAS[]` gana `demo: PestanaId`.

- [ ] **Step 1:** Títulos y pestañas exactos (textos e íconos se quedan):
  | Título nuevo | `demo` |
  |---|---|
  | ¿Ya nos pasamos de cable? | `presupuesto` |
  | ¿Ya mandaron las fotos? | `avances` |
  | ¿Quién tiene la fusionadora? | `herramientas` |
  | ¿Por qué me entero hasta el final? | `tablero` |
- [ ] **Step 2:** Bajo cada `dd`, `<a href="#demo" onClick={() => ver(p.demo)}>Verlo en la demo</a>` con `aria-label` "Verlo en la demo: <título de la pestaña>" (Review Focus 5); estilo de enlace de texto en `text-accent`, foco visible.
- [ ] **Step 3:** `npm run build` → OK. Captura 1364 px: clic en "¿Ya mandaron las fotos?" baja a la demo con "Avances" activa y sin barra de progreso.
- [ ] **Step 4:** Commit `feat(landing): problemas como preguntas con enlace a la demo`.

### Task 4: Franja de giros

**Files:**
- Modify: `web/src/pages/Landing.tsx` (nuevo `Giros()` entre `<Portada />` y `<Problema />`; íconos nuevos junto a `IconCaja`)

**Interfaces:**
- Produces: `const GIROS: { nombre: string; icono: Icono }[]` en este orden: Obra civil, Instalaciones eléctricas, Voz y datos, CCTV y seguridad, Aire acondicionado, Plomería, Mantenimiento, Servicios en campo.

- [ ] **Step 1:** Dibujar 8 íconos 24×24 con `trazoIcono` (reutilizar `IconObras`/`IconHerramientas` de `Icons.tsx` donde encajen).
- [ ] **Step 2:** `Giros()`: `<section aria-label="Para qué giros es Bitácora">` con lista `<ul>` que hace wrap (`flex flex-wrap`), ícono `text-accent` + nombre; sin animación.
- [ ] **Step 3:** `npm run build` → OK. Capturas 360 y 1364 px: `document.documentElement.scrollWidth <= innerWidth` (Review Focus 4).
- [ ] **Step 4:** Commit `feat(landing): franja de giros`.

### Task 5: Portada — chat de obra que da paso al tablero

**Files:**
- Modify: `web/src/pages/Landing.tsx` (`Portada` 65-97, `TableroObra` 99-166)
- Modify: `web/src/index.css` (clases de animación + bloque `prefers-reduced-motion` en 54-59)

**Interfaces:**
- Produces: `TableroObra({ listo }: { listo: boolean })` (el `useEffect`/`requestAnimationFrame` interno se elimina; las barras se llenan cuando `listo` pasa a `true`).
- Produces: `ChatObra({ mostrados }: { mostrados: number })` con los 3 mensajes exactos del spec, grupo "Obra Clínica Zapopan"; `aria-hidden` (decorativo, Review Focus 5).

- [ ] **Step 1:** Copy de la portada según Global Constraints; botones y nota "Sin tarjeta…" se quedan.
- [ ] **Step 2:** En `Portada`, estado `fase: 0..4` avanzado con `setTimeout` (mensajes en ~0.6 s, 1.4 s, 2.2 s; tablero en ~3.2 s); limpiar timers al desmontar (Review Focus 1). Si `matchMedia("(prefers-reduced-motion: reduce)").matches`, arrancar en `fase = 4`.
- [ ] **Step 3:** Composición: contenedor `relative` con alto fijo por breakpoint; chat arriba; el tablero entra deslizándose desde abajo y queda encima, dejando visible el encabezado del chat y el último mensaje. `listo = fase === 4`.
- [ ] **Step 4:** Añadir al bloque reduced-motion de `index.css` las clases nuevas en su estado final.
- [ ] **Step 5:** `npm run build` → OK. Capturas a 360 y 1364 px en t≈1 s y t≈5 s, y una con `reducedMotion: "reduce"`: estado final directo, nada tapa el texto ni los botones.
- [ ] **Step 6:** Commit `feat(landing): portada con el chat de obra`.

### Task 6: Sección del giro, cierre y pie

**Files:**
- Modify: `web/src/pages/Landing.tsx` (`PorQue` 310-352, `Cierre` 414-426, pie líneas 36-41)
- Modify: `web/src/vite-env.d.ts` (o crear si no existe) para tipar `VITE_WHATSAPP`

**Interfaces:**
- Consumes: `whatsappUrl` de Task 1.
- Produces: `const CITA: { texto: string; nombre: string; cargo: string } | null = null` en `Landing.tsx` con comentario `// Pendiente: texto aprobado por Edgar; mientras sea null el bloque no se dibuja.`

- [ ] **Step 1:** `PorQue`: título "Nació en una empresa del giro, no en una oficina."; si `CITA` no es `null`, `<figure><blockquote>…</blockquote><figcaption>nombre, cargo</figcaption></figure>` arriba de las razones.
- [ ] **Step 2:** Pie: "Bitácora, control de obras para contratistas de construcción y servicios en campo. Guadalajara, Jalisco."
- [ ] **Step 3:** `Cierre`: bajo el texto, "Vamos a tu obra en Jalisco y lo cargamos contigo."; junto a "Crear cuenta gratis", botón secundario "Escríbenos por WhatsApp" con `href = whatsappUrl(import.meta.env.VITE_WHATSAPP, "Hola, quiero conocer Bitácora para mi empresa.")`, `target="_blank" rel="noopener"`; no se dibuja si es `null`.
- [ ] **Step 4:** `npm run build` → OK. Captura sin la variable: no hay botón ni cita. Con `VITE_WHATSAPP=523312345678 npm run dev`: el botón aparece y su `href` es el de la prueba de Task 1.
- [ ] **Step 5:** Commit `feat(landing): cierre con WhatsApp opcional y textos del giro`.

### Task 7: Integración

- [ ] **Step 1:** `cd server && npx tsx --test ../web/src/lib/*.test.ts` → todo PASS; `cd web && npm run build` → OK.
- [ ] **Step 2:** Recorrido completo a 360 y 1364 px (incluye reduced-motion); revisar Review Focus 1-5.
- [ ] **Step 3:** Agregar en `docs/SAAS-CHECKLIST.md` bajo "Landing pública": pendientes número de WhatsApp (`VITE_WHATSAPP` en Vercel) y cita de Edgar (`CITA` en `Landing.tsx`).
- [ ] **Step 4:** Merge `saas/landing-giro` → `dev`, push solo a `dev`; revisar el preview de Vercel.
