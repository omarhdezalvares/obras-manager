# Panel de super admin — diseño

Fecha: 2026-11-26 · Rama: `saas/super-admin` (desde dev)

## Para qué

Los dueños de Bitácora (Omar y su socio) necesitan administrar a sus clientes sin entrar a la base:
corregir el plan cuando algo falla, activar empresas que pagaron fuera de Stripe, ver quién está al corriente,
y entender quién compra, qué paquete se compra más y cómo se enteraron de la app, para dirigir el marketing.

## Metas

1. Tablero de clientes con estado de cobro de todas las empresas.
2. Ficha por empresa con acciones manuales: registrar pago, cambiar plan, suspender/reactivar, corregir giro y canal.
3. Tendencias: registros vs. compras por giro y por canal, y plan más comprado.
4. Capturar giro y canal ("¿cómo te enteraste?") en el registro, para que las tendencias tengan datos.

## No metas

- Editar datos operativos de una empresa (obras, usuarios, materiales) o entrar "como" ella.
- Cobrar o reembolsar desde el panel: lo que pasa por Stripe se hace en Stripe.
- Roles distintos dentro del panel: los dos super admin pueden todo.
- Medir tamaño de empresa en las tendencias (el usuario lo descartó).

## Anti-metas

- Que un cliente pueda llegar al panel o a datos de otra empresa por cualquier vía (rol, token manipulado, edición desde la app).
- Que una acción manual quede sin rastro de quién la hizo.

## Enfoques considerados

- **A. Dentro de la misma app, lista de correos en la configuración (elegido).** Login normal; `/admin` visible solo si el
  correo del usuario está en `SUPERADMIN_EMAILS`. Reusa login, despliegue y recuperación de contraseña.
- B. Cuentas de super admin aparte con su propio login: separación más limpia, casi el doble de trabajo para dos personas.
- C. App separada: dos proyectos que mantener y la misma base de todos modos.

El usuario eligió A.

## Lo decidido con el usuario

### Acceso
- Usuarios: Omar y su socio, ambos con todos los permisos.
- `SUPERADMIN_EMAILS` (variable de entorno, separada por comas, sin distinguir mayúsculas) define quién es super admin.
  Nunca se concede desde la app ni desde la base.
- En cada petición a `/api/admin/*` el servidor lee el correo del usuario desde la base (no del token) y lo compara con la lista;
  si no está, 404 (no revelar que el panel existe).
- Sus cuentas viven en una empresa interna "Bitácora" (plan `piloto`), excluida de tablero y tendencias.
- Cada acción guarda el usuario que la hizo en `AuditLog` (`usuarioId` del super admin, `tenantId` de la empresa afectada).

### Registro: dos preguntas nuevas, obligatorias y de un clic
- **¿A qué se dedica tu empresa?** Obra civil, Instalaciones eléctricas, Voz y datos, CCTV y seguridad, Aire acondicionado,
  Plomería, Mantenimiento, Servicios en campo, Otro (los 8 giros de la landing + Otro).
- **¿Cómo te enteraste de Bitácora?** Facebook / Instagram, Google, Recomendación, WhatsApp, Evento o expo, Otro (con campo de texto).
- Empresas existentes quedan "Sin dato"; el super admin puede corregirlo en la ficha.

### Tablero de clientes
- Contadores: Pagando · En prueba · Pago pendiente · Solo lectura · Suspendidas (los estados de `lib/plan.ts`; piloto aparte).
- Ingreso mensual estimado: suma del precio de lista (1,290 / 2,690 / 5,490 + IVA) de las empresas en estado activa o gracia
  con plan pagado. Se rotula "estimado".
- Tabla: empresa, giro, plan, estado, pagado hasta, forma de pago, último acceso. Filtros por estado, plan y giro; búsqueda por nombre o correo.

### Ficha de empresa
- Datos, correo del administrador, usuarios y obras activas vs. límite, historial de cambios de plan y pagos (Stripe y manuales).
- Acciones:
  - **Registrar pago manual:** plan, pagado hasta (fecha), monto opcional, nota. Pone `origenPago = "manual"`, `metodoPago = "manual"`,
    `plan`, `vigenteHasta`.
  - **Cambiar plan** sin tocar fechas.
  - **Suspender / reactivar** (`Tenant.activo`).
  - **Corregir giro y canal.**
- Si la empresa tiene suscripción de Stripe, las acciones de plan y pago avisan:
  "Esta empresa paga con Stripe; el cambio se revierte en su próximo cobro."

### Tendencias
- Periodo: últimos 30 días, 90 días, 12 meses, todo.
- Por giro y por canal: registros (empresas creadas en el periodo), compraron, conversión %.
- Plan más comprado: conteo por plan entre las empresas del periodo que compraron.
- **"Compró"** = tuvo al menos un pago real: factura de Stripe pagada con monto > 0, o un pago manual registrado.

## Lo que decidí yo (el usuario puede corregir)

- **Datos nuevos en `Tenant`:** `giro String?`, `canal String?`, `canalDetalle String?` (texto de "Otro"), `primerPagoAt DateTime?`.
  `RegistroPendiente` guarda giro/canal/canalDetalle hasta que se confirma el correo.
  `primerPagoAt` lo pone el webhook (`invoice.paid` con `amount_paid > 0`, solo si está vacío) y el pago manual (solo si está vacío).
  Se migra en blanco: las compras previas no se reconstruyen (en prod solo hay piloto).
- **Historial de pagos manuales en `AuditLog`** (`accion: "pago_manual"`, monto y nota en `cambios`), sin tabla nueva.
- **"Registros" cuenta empresas confirmadas**; los registros pendientes se borran al vencer y no son un embudo confiable.
- **La empresa interna se identifica** por tener algún usuario cuyo correo está en `SUPERADMIN_EMAILS`; esas empresas se excluyen
  de tablero y tendencias y no se pueden suspender desde el panel.
- **Alta de las cuentas super admin:** script `server/scripts/crear-superadmin.ts --email <correo>` que crea (si falta) la empresa interna
  "Bitácora" y el usuario Administrador; la contraseña se toma de una variable de entorno y no se imprime.
  (Resend no entrega a otros correos hasta tener dominio, por eso no se usa el link de "olvidé mi contraseña".)
- **Plan en pago manual y cambio de plan:** básico, profesional, empresa o piloto (para clientes piloto sin cobro).
- **Empresas sin giro o canal** aparecen como fila "Sin dato" en tendencias.
- **"Correo del administrador"** en la ficha = el Administrador activo más antiguo de la empresa.
- **Menú:** `/auth/me` agrega `superAdmin: boolean`; el Layout muestra "Panel Bitácora" solo si es true. La web solo oculta;
  la protección real es el servidor.
- **Rutas web:** `/admin` (tablero), `/admin/empresas/:id` (ficha), `/admin/tendencias`.

## Restricciones

- Stack actual: Express + Prisma + React/Vite, tests con `node:test` + `tsx --test` en schemas `test_*`.
- Migración aditiva (columnas nulas); prod (`public`) solo tiene empresas piloto.
- Archivos con CRLF.

## Para quien construya

Diseño visual del panel (seguir componentes de `web/src/components/ui`), forma exacta de las respuestas JSON, paginación
(con decenas de empresas basta sin paginar; dejar `shortcut:` si se omite), y orden de columnas.
