# Rediseño visual "concreto y señalización" — Diseño

**Maqueta aprobada:** https://claude.ai/artifact/CdKmy5da7xXteeMT7AEYDv (Dashboard, Obra › Dinero, Dashboard celular, Indicadores, Reporte PDF, Oficial celular).

## Intención

Que Bitácora se vea como una herramienta profesional de constructora y se lea de un vistazo: indicadores arriba en una fila, gráficas para lo que hoy se lee número por número, listas consistentes y compactas. El oficial usa la app solo en celular: su vista se diseña primero para 390 px.

## Metas

1. Nueva identidad: barra superior grafito `#1F2328`, fondo concreto `#F3F3F1`, superficie blanca con borde `#E2E2DE`, tinta `#1C1F23` / `#5B6068`, acento naranja de seguridad (marcas `#E0701F`, texto y botones `#B4500C`), azul acero `#2F6DB0` para series. Estados: ok `#1E7A46`, warn `#8A5A00` (texto) / `#C26A00` (marca), crit `#B42318`. Tipografía IBM Plex Sans; cifras en IBM Plex Mono tabular.
2. Una sola regla de espaciado: 24 px entre secciones, 16 px entre tarjetas, listas como **una tarjeta con filas divididas** (nunca tarjetas sueltas apiladas). Tablas para Obras, Partidas, Movimientos.
3. Dashboard: fila de 5 indicadores; "Consumo por obra"; "Gasto diario (14 días)" mano de obra/material; "Personal en obra por día" (mapa de calor); tabla Obras; "Pendientes de hoy" (une Para hoy + Alertas, sin repetir).
4. Obra: indicadores de la obra en una fila, aviso de partida como franja, pestañas con subrayado naranja; Dinero con tablas y "Ver más" en movimientos.
5. Reportes › Indicadores: filtros (14 días / mes / personalizado, obra), 6 indicadores, mapa de calor personal por día, obras por persona (+ personas sin obra), herramientas por obra + estado del inventario, cumplimiento de bitácora, días-hombre y costo por obra, plazo contra gasto (estado vacío si no hay fecha fin estimada).
6. Oficial mobile-first: saludo + obras de hoy con lista de estado (llegada / evidencia); pantalla de obra con dos botones grandes ("Registrar mi llegada · hora", "Subir evidencia"), quién llegó y última evidencia; evidencia con mosaico de fotos, botón "Tomar foto" y botón Guardar fijo abajo.
7. PDF de evidencias: encabezado con logo, RFC/contacto, folio y fecha de emisión; ficha técnica en tabla; resumen del periodo (días con registro, días-hombre, fotos, personas); registros numerados con fecha al costado y etiqueta de fotos; fotos de tamaño uniforme con pie; pie de página con empresa, folio y obra; página final de firmas (Supervisor, Residente, Cliente); textos con acentos.
8. **Celular sin pérdidas:** a 390 px ninguna pantalla tiene scroll horizontal de página; las cuadrículas se apilan; los indicadores se deslizan en una fila; las tablas anchas se desplazan dentro de su tarjeta.

## No metas

- No cambian nombres de secciones ni flujos aprobados en `mejoras-ux` (4 pestañas, menú Configuración).
- Sin librerías nuevas (gráficas hechas con elementos HTML; PDF sigue en pdfkit con Helvetica).
- Sin modo oscuro.

## Anti-metas

- Montos o gráficas de dinero visibles para roles sin acceso financiero.
- Una pantalla que en celular obligue a desplazarse de lado.
- Un dato inventado en una gráfica: si no hay dato, estado vacío que diga qué falta.

## Restricciones

- Las gráficas respetan `visibleObraIds` y `puedeVerFinanciero`.
- Contraste de texto ≥ 4.5:1; objetivos táctiles ≥ 44 px; la identidad de series nunca solo por color (leyenda + texto).
- El color del encabezado del PDF sigue siendo el `colorPrimario` de Empresa.

## Decisiones del constructor (mías)

- El token `accent` de Tailwind se reasigna al naranja (texto `#B4500C`) para no reescribir cada clase.
- "Llegadas tarde" no se calcula (no hay hora de entrada configurada); se muestra la llegada promedio.
- Folio del PDF: `RE-AAAAMMDD-XXXX` (fecha de emisión + 4 primeros caracteres del id de obra), sin consecutivo guardado.
