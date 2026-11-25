# Landing que habla el idioma del giro

Fecha: 2026-11-25 · Estado: borrador para aprobación

## Por qué

La landing actual (`web/src/pages/Landing.tsx` + `LandingDemo.tsx`, rama `saas/landing`, ya en dev) explica bien el producto, pero suena a software. El dueño de una contratista de construcción o de servicios en campo vive su obra en un grupo de WhatsApp: fotos sueltas, "¿quién tiene la fusionadora?", "¿ya nos pasamos de cable?". La landing debe abrir en ese momento y mostrar que Bitácora lo ordena.

## Metas

- Que en los primeros segundos el visitante reconozca su propio grupo de WhatsApp de obra.
- Que vea que la herramienta es para su giro (construcción y servicios en campo, no solo instalaciones).
- Que pueda saltar de su problema concreto a la pantalla de la demo que lo resuelve.
- Dar cara humana con una cita real del piloto.

## No metas

- Sin mascota ni avatar (se exploraron Resi y Bita; se descartaron el 2026-11-25).
- No se rehace el diseño: se quedan colores, tipografía (IBM Plex), íconos de línea, animaciones, demo y planes.
- No se cambian precios, registro ni rutas (`/`, `/registro`, `/entrar`).

## Anti-metas (sería un fracaso aunque funcione)

- Que se pierda algo de lo que ya existe (íconos, gráfica de la fuga, línea del día, demo).
- Un botón de WhatsApp que apunte a un número falso o vacío.
- Animación que no respete "reducir movimiento" o que tape el contenido en celular.

## Las 8 secciones

Gris = se queda como está. Lo demás se agrega o ajusta con el mismo estilo.

1. **Portada (ajuste).**
   - Título nuevo: "Tu obra no cabe en un grupo de WhatsApp." (reemplaza el H1 actual).
   - Subtítulo: "Asistencia, avances con foto, material y herramienta de tus cuadrillas, al día y en el celular." y debajo "Para construcción y servicios en campo."
   - Botones actuales: "Prueba 14 días gratis" y "Ver la demo"; se queda la nota "Sin tarjeta…".
   - Lado derecho: un chat tipo WhatsApp del grupo "Obra Clínica Zapopan" con 3 mensajes que llegan uno por uno ("¿Alguien tiene la fusionadora?", "Ahí van las fotos del jueves 📷", "¿Ya nos pasamos de cable?"). Después el `TableroObra` que ya existe se desliza encima y se llenan sus barras y su curva.
   - Con "reducir movimiento": se muestra directo el tablero (el chat puede quedar detrás, visible en parte o no; decisión del builder).
2. **Franja de giros (nueva).** Una fila de íconos de línea con etiqueta: Obra civil, Instalaciones eléctricas, Voz y datos, CCTV y seguridad, Aire acondicionado, Plomería, Mantenimiento, Servicios en campo. En celular se acomoda en varias filas o se desliza; sin scroll horizontal de la página.
3. **Así se va el dinero (ajuste).** Se quedan los 4 íconos, los textos y la gráfica de la fuga. Los títulos pasan a ser preguntas del dueño, y cada bloque lleva un enlace "Verlo en la demo":
   | Título actual | Título nuevo | Abre la pestaña |
   |---|---|---|
   | El material sale y nadie sabe a dónde | ¿Ya nos pasamos de cable? | Presupuesto |
   | Las estimaciones se atoran | ¿Ya mandaron las fotos? | Avances |
   | ¿Quién tiene la fusionadora? | ¿Quién tiene la fusionadora? | Herramientas |
   | Te enteras cuando ya terminó | ¿Por qué me entero hasta el final? | Tablero |
4. **Un día de obra.** Se queda igual.
5. **Recorre Bitácora (demo).** Se queda igual. Solo se agrega que el enlace de la sección 3 baje a `#demo` y deje activa la pestaña pedida (cuenta como interacción manual: deja de rotar sola).
6. **Nació en una empresa del giro (ajuste).** Se quedan título, texto y las 4 razones. Arriba va un bloque para la cita de Edgar (aprobada por él), con nombre y cargo. **Sale oculto** hasta tener el texto (ver pendientes); mientras, la sección se ve como hoy.
   - El título actual dice "de instalaciones"; se puede dejar o ampliar a "del giro" (decisión del builder, sin cambiar el sentido).
7. **Planes.** Se quedan igual.
8. **Cierre (ajuste).** Junto a "Crear cuenta gratis" se agregan:
   - "Escríbenos por WhatsApp": **oculto hasta tener el número** (pendiente).
   - La frase "Vamos a tu obra en Jalisco y lo cargamos contigo."

## Restricciones

- React + Tailwind como el resto de la landing; sin dependencias nuevas.
- Íconos nuevos junto a los demás íconos propios de la landing (`Landing.tsx`, con `trazoIcono`), mismo trazo que los existentes.
- Funciona a 360 px de ancho sin scroll horizontal.
- Animaciones solo al entrar en pantalla (reutilizar `useVisible` de `LandingDemo.tsx`) y apagadas con `prefers-reduced-motion`.
- Rama nueva desde `dev` (`saas/landing-giro`), merge a `dev`, push solo a `dev`.

## Pendientes

- [ ] Número de WhatsApp para el botón del cierre (hasta entonces el botón no se muestra).
- [ ] Texto exacto de la cita de Edgar y cómo firmarla.

## Decisiones tomadas en la revisión (llamadas de Claude, revisables)

- **Cita de Edgar**: decidido por Omar (2026-11-25), el bloque se construye y sale oculto hasta tener el texto y la firma, igual que WhatsApp. No hay texto provisional visible.
- **Número de WhatsApp** en la variable `VITE_WHATSAPP` (solo dígitos, con lada, p. ej. `523312345678`). Sin la variable, el botón no se dibuja. Enlace `https://wa.me/<número>?text=` con el mensaje "Hola, quiero conocer Bitácora para mi empresa." Así aparece en cada entorno sin cambiar código.
- **Pie de página**: "contratistas de instalaciones" pasa a "contratistas de construcción y servicios en campo". El título de la sección 6 pasa a "Nació en una empresa del giro, no en una oficina." Los datos de la demo y del `TableroObra` (cableado, CCTV) se quedan.
- **Al terminar la animación**: el tablero queda encima del chat y deja asomar el último mensaje arriba. El contenedor tiene alto fijo por tamaño de pantalla para que nada se mueva ni se tape a 360 px.

## Lo que queda al builder

- Diseño visual del chat (burbujas, nombres, horas) dentro de la paleta actual.
- Duración y ritmo de la animación chat → tablero.
- Cómo pasar la pestaña pedida a la demo (prop, estado compartido o hash).
- Íconos de cada giro.
