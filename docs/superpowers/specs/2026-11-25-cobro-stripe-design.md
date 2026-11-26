# Cobro con Stripe: planes, prueba gratis, límites y solo lectura

Fecha: 2026-11-25 · Estado: borrador para aprobación

## Por qué

Bitácora ya está publicada y tiene registro de empresas, pero no cobra. `Tenant.plan` existe ("trial" al registrarse, "piloto" para la empresa de Edgar) y no hace nada. La landing promete 14 días gratis sin tarjeta y tres planes con límites. Este proyecto hace que esa promesa sea real y deja la base para el panel de super administrador (proyecto siguiente).

## Metas

- Prueba de 14 días desde el registro, sin capturar datos de pago.
- El administrador de la empresa contrata Básico, Profesional o Empresa pagando con **tarjeta** (cobro automático) o **transferencia SPEI** (factura mensual de Stripe con datos para transferir).
- Límites por plan al dar de alta obras activas y usuarios.
- Si no paga (fin de prueba o mensualidad vencida): **7 días de gracia con avisos, luego solo lectura** (ve todo y descarga reportes, no captura nada). Al pagar se reactiva al momento.
- La empresa de Edgar (plan "piloto") nunca paga ni se suspende.
- Lo que el panel de super admin va a necesitar ya existe: vigencia, origen del pago, IDs de Stripe, historial de cambios.

## No metas

- Panel de super administrador (siguiente proyecto; aquí solo los campos y la regla de estado que usará).
- Facturación CFDI, planes anuales, cupones, OXXO.
- Activar la cuenta de Stripe en modo real: se construye y prueba en **modo de pruebas**; el paso a producción es configuración (llaves y precios), no código.

## Anti-metas

- Cortar de golpe a una cuadrilla en obra.
- Que un pago confirmado no reactive la empresa (o que dependa de que alguien abra la app).
- Que una tarjeta pase por nuestro servidor.
- Borrar o esconder datos de una empresa por falta de pago.

## Planes

| Plan (`Tenant.plan`) | Precio mensual | Obras activas | Usuarios |
|---|---|---|---|
| `trial` | gratis 14 días | 3 | 10 |
| `basico` | $1,290 MXN | 3 | 10 |
| `profesional` | $2,690 MXN | 10 | 30 |
| `empresa` | $5,490 MXN | sin límite | sin límite |
| `piloto` | gratis, sin vencimiento | sin límite | sin límite |

Precios **más IVA** (decidido por Omar; la landing ya dice "/ mes + IVA"). En Stripe cada Price es el monto sin IVA y la suscripción lleva un Tax Rate "IVA 16%" exclusivo (`default_tax_rates`), creado en Stripe y pasado por `STRIPE_TAX_RATE_IVA`. El cliente paga $1,496.40 / $3,120.40 / $6,368.40.

Llamada de Claude: la prueba tiene los límites de Básico. Los precios viven en Stripe (un Price por plan); el código solo conoce los IDs por variables de entorno.

Fuera de este proyecto: la implementación en sitio se cobra aparte y a mano; la landing ya no muestra su precio, solo "Contáctanos" (decidido por Omar).

## Enfoque elegido

Se consideraron tres:

- **A. Páginas de Stripe (elegido por Omar).** Checkout para tarjeta, factura de Stripe para SPEI, Customer Portal para tarjeta, cambio de plan y cancelación, webhooks para enterarse. Mínimo código, la tarjeta nunca toca nuestro servidor, Stripe trae recibos y reintentos en español.
- B. Formulario de pago embebido (Elements): experiencia 100% propia, 3-4 veces más trabajo.
- C. Payment Links sin código: no liga pagos con empresas ni maneja cambios de plan o suspensión.

Hallazgos de la documentación de Stripe (2026-11-25):
- Checkout **no** acepta transferencia en suscripciones; SPEI va por suscripción con `collection_method=send_invoice` y `payment_settings.payment_method_types=["customer_balance"]`. MXN soportado.
- El Customer Portal no permite cambiar de plan a suscripciones `send_invoice` (sí cancelar). El cambio de plan de clientes SPEI se hace desde Bitácora.

## Cómo funciona

### Una sola fecha decide el estado

`Tenant` gana `vigenteHasta: DateTime?`. El estado se **calcula**, no se guarda:

- `plan = "piloto"` → **activo** siempre.
- hoy ≤ `vigenteHasta` → **activo** (en prueba si `plan = "trial"`).
- hoy ≤ `vigenteHasta` + 7 días → **gracia** (todo funciona, avisos visibles).
- después → **solo lectura**.
- `activo = false` (interruptor existente) → **suspendida** por decisión manual: no entra nadie (comportamiento actual en login; se extiende a cada petición).

Quién mueve la fecha:
- Registro: `vigenteHasta = ahora + 14 días`, `plan = "trial"`.
- Webhook `invoice.paid` de la suscripción: `vigenteHasta = fin del periodo pagado`, `plan` = el del Price.
- Super admin (siguiente proyecto): "pagado hasta" manual cuando se cobra por fuera de Stripe.
- Nada más. Cancelar, tarjeta rechazada o factura vencida **no** tocan la fecha: la empresa cae sola en gracia y luego en solo lectura cuando se cumple.

Esto evita tareas programadas: el estado se evalúa en cada petición.

### Campos nuevos en `Tenant`

`vigenteHasta DateTime?`, `stripeCustomerId String? @unique`, `stripeSubscriptionId String? @unique`, `metodoPago String?` ("tarjeta" | "transferencia"), `origenPago String?` ("stripe" | "manual"). Migración: empresas existentes `trial` → `vigenteHasta = createdAt + 14 días`; `piloto` sin fecha.

### Contratar

Pantalla **"Plan y pago"** en Configuración, solo para el rol Administrador (los demás ven el estado pero no el botón):
- Muestra plan actual, estado y "vigente hasta", uso contra límites (obras activas, usuarios).
- Elegir plan + forma de pago:
  - **Tarjeta** → `POST /api/facturacion/checkout` crea Checkout Session (`mode=subscription`, Price del plan, `client_reference_id = tenantId`, metadata `tenantId`) y redirige. Vuelve a "Plan y pago" con aviso.
  - **Transferencia** → `POST /api/facturacion/transferencia` crea (o reutiliza) el Customer y una suscripción `send_invoice`, `days_until_due = 5`. Stripe envía la factura por correo al correo del administrador; la pantalla muestra el enlace a la factura pendiente.
- Con suscripción activa:
  - Tarjeta → botón "Administrar pago" abre el Customer Portal (cambiar plan, tarjeta, facturas, cancelar).
  - Transferencia → "Cambiar plan" en Bitácora (`POST /api/facturacion/cambiar-plan`, actualiza el Price de la suscripción; aplica desde la siguiente factura) y "Ver facturas / cancelar" en el Portal.
- Un Customer de Stripe por empresa, creado en el primer contrato, con nombre de la empresa y correo del administrador.

### Webhook

`POST /api/facturacion/webhook`, sin sesión, con verificación de firma (cuerpo crudo, antes del parser JSON). Eventos:
- `checkout.session.completed` → liga `stripeCustomerId`/`stripeSubscriptionId` al tenant de `client_reference_id`.
- `invoice.paid` → mueve `vigenteHasta` y `plan`; `origenPago = "stripe"`.
- `customer.subscription.updated` → actualiza `plan` si cambió el Price (no mueve la fecha).
- `customer.subscription.deleted` → borra `stripeSubscriptionId` (la fecha se queda; caerá sola).
- Idempotente: reprocesar un evento no cambia el resultado. Eventos de clientes desconocidos se ignoran con 200.
- Cada cambio de plan o fecha se escribe en la auditoría existente (`writeAuditLog`).

### Límites

Al crear una obra (o reactivarla a estado activo) y al crear o reactivar un usuario: si el conteo actual llega al límite del plan → 403 con mensaje "Tu plan permite N obras activas. Sube de plan para agregar más." Lo existente no se toca aunque exceda (p. ej. tras bajar de plan).

### Solo lectura y avisos

- Middleware después de `requireAuth`: si el estado es **solo lectura**, cualquier `POST/PUT/PATCH/DELETE` responde 402 `{ error, estado: "solo_lectura" }`, excepto `/api/auth/*` y `/api/facturacion/*`. Las descargas de reportes (GET) siguen.
- Si es **suspendida**, toda petición autenticada responde 403 (hoy solo se revisa al iniciar sesión).
- La app web recibe el estado (en la sesión o en `/api/empresa`) y muestra una franja arriba:
  - prueba: "Te quedan N días de prueba" (desde 5 días antes), con enlace a "Plan y pago".
  - gracia: "Tu pago está pendiente. El DD/MM tu cuenta pasa a solo lectura."
  - solo lectura: "Tu cuenta está en solo lectura. Contrata un plan para seguir capturando."
- Los avisos son en la app; correos de aviso propios quedan fuera (Stripe ya manda recordatorios de facturas y tarjetas rechazadas).

## Decisiones de la revisión (llamadas de Claude, revisables)

- **Contratar durante la prueba no quema días:** la suscripción (Checkout y SPEI) se crea con `trial_end = vigenteHasta` si aún está vigente; el primer cobro cae al terminar la prueba. "Plan y pago" lo dice: "Tu primer cobro será el DD/MM".
- **El plan cambia solo cuando hay una factura pagada.** `invoice.paid` es lo único que escribe `plan` y `vigenteHasta`; `customer.subscription.updated` solo sincroniza IDs.
  - Subir de plan: se cobra la diferencia prorrateada en ese momento (`proration_behavior=always_invoice`). Con tarjeta se cobra sola; con SPEI se emite una factura y el plan nuevo aplica al pagarla.
  - Bajar de plan: aplica al final del periodo pagado (Portal configurado para programar bajadas al fin del periodo; `cambiar-plan` hace lo mismo).
- **Usuarios** (decidido por Omar): solo cuentas con acceso a la app (`Usuario` con `activo = true`). El personal de cuadrilla (`Persona`) sin acceso no cuenta. Se revisa al crear un usuario y al reactivarlo.
- **Obras activas** = las que no están `cerrada` ni `cancelada` (planeada, en ejecución y pausada cuentan). Se revisa al crear y al pasar de cerrada/cancelada a otro estado.
- **En solo lectura siguen permitidos** además de auth y facturación: `POST /api/reportes/:tipo/exportar` y marcar notificaciones como leídas.

## Restricciones

- Dependencia nueva aceptada: el SDK oficial `stripe` en `server/` (firma de webhooks y tipos). Llamada de Claude.
- Variables de entorno: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASICO`, `STRIPE_PRICE_PROFESIONAL`, `STRIPE_PRICE_EMPRESA`, `STRIPE_TAX_RATE_IVA`. Sin ellas el servidor arranca y "Plan y pago" muestra "Cobro no configurado" (local y tests no necesitan Stripe).
- Express en Vercel (`api/index.ts`): la ruta del webhook necesita el cuerpo crudo.
- Pruebas `node:test` con `tsx --test` como el resto del server; el webhook se prueba con eventos firmados localmente con el secreto de prueba, sin red.
- Ramas: una por paso desde `dev`, merge a `dev`, push a `dev`. Producción (main) se publica cuando Omar lo pida.

## Pendientes de Omar

- [ ] Abrir la cuenta de Stripe (México) y pasarme las llaves de **prueba** escribiéndolas en `server/.env` (no en el chat).
- [ ] Crear o dejarme crear los 3 productos/precios en modo de prueba.

## Lo que queda al builder

- Diseño de la pantalla "Plan y pago" y de la franja de avisos, con los componentes existentes.
- Dónde viaja el estado al cliente (sesión vs `/api/empresa`).
- Texto exacto de los mensajes de error, respetando el sentido de arriba.
