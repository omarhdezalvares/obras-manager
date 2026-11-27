import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "../components/Icons";

// Debe coincidir con VERSION_LEGAL en server/src/lib/legal.ts: es la version que acepta quien se registra.
const FECHA = "26 de noviembre de 2026";
const RESPONSABLE = "Omar Hernandez Alvares";
const DOMICILIO = "Aurora Boreal 3220, Lomas de San Eugenio, C.P. 44720, Guadalajara, Jalisco, México";
const CORREO = "bitacora.app.lab@gmail.com";

function Documento({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ground px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-4 text-[15px] leading-relaxed text-ink [&_h2]:pt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        <Link to="/" className="mb-6 flex items-center gap-2 text-lg font-semibold text-ink">
          <LogoMark className="h-6 w-6 text-accent" />
          Bitácora
        </Link>
        <h1 className="text-3xl font-semibold">{titulo}</h1>
        <p className="text-sm text-ink-soft">Última actualización: {FECHA}</p>
        {children}
        <p className="border-t border-line pt-6 text-sm text-ink-soft">
          <Link to="/terminos" className="hover:text-accent">Términos y condiciones</Link> · <Link to="/privacidad" className="hover:text-accent">Aviso de privacidad</Link> · <Link to="/" className="hover:text-accent">Inicio</Link>
        </p>
      </article>
    </div>
  );
}

const correo = <a href={`mailto:${CORREO}`} className="font-medium text-accent hover:underline">{CORREO}</a>;

export function Terminos() {
  return (
    <Documento titulo="Términos y condiciones">
      <p>
        Estos términos regulan el uso de Bitácora (el "Servicio"), una plataforma en línea para controlar obras, personal, materiales,
        herramientas y avances. El Servicio lo presta {RESPONSABLE}, con domicilio en {DOMICILIO} ("Bitácora", "nosotros"). Quien crea una
        cuenta lo hace en nombre de una empresa o negocio (el "Cliente") y declara tener facultades para obligarlo. Al marcar la casilla de
        aceptación al registrarse, el Cliente acepta estos términos y el <Link to="/privacidad" className="text-accent hover:underline">Aviso de privacidad</Link>.
      </p>

      <h2>1. Cuenta y usuarios</h2>
      <ul>
        <li>El Cliente debe dar información veraz y mantener actualizado su correo de contacto.</li>
        <li>El Cliente es responsable de los usuarios que invite, de los permisos que les asigne y de todo lo que hagan con su cuenta.</li>
        <li>Las contraseñas son personales. Si sospechas un acceso no autorizado, cámbiala y avísanos a {correo}.</li>
      </ul>

      <h2>2. Prueba gratis</h2>
      <p>
        Cada empresa nueva tiene 14 días de prueba sin costo y sin tarjeta. Al terminar, el Cliente puede contratar un plan; si no lo hace,
        aplica lo descrito en la sección 4.
      </p>

      <h2>3. Planes, precios y pago</h2>
      <ul>
        <li>Los planes, sus límites (obras activas, usuarios) y sus precios son los publicados en el sitio al momento de contratar. Los precios están en pesos mexicanos y no incluyen IVA.</li>
        <li>El cobro es mensual y por adelantado, con tarjeta o transferencia SPEI, a través de Stripe. Con tarjeta, la suscripción se renueva sola cada mes hasta que se cancele.</li>
        <li>Si cambiamos un precio, avisaremos por correo al menos 30 días antes de que aplique a tu siguiente cobro.</li>
        <li>Las facturas (CFDI) se solicitan a {correo} con los datos fiscales del Cliente, dentro del mes en que se hizo el pago.</li>
      </ul>

      <h2>4. Falta de pago</h2>
      <p>
        Si un pago no se recibe en su fecha, la cuenta sigue funcionando normalmente durante 7 días de gracia. Después pasa a modo de solo
        lectura: el Cliente puede consultar su información y descargar sus reportes, pero no registrar datos nuevos. Al pagar, la cuenta
        vuelve a funcionar de inmediato con toda su información.
      </p>

      <h2>5. Cancelación</h2>
      <ul>
        <li>El Cliente puede cancelar en cualquier momento desde la sección Plan de la aplicación o escribiendo a {correo}.</li>
        <li>Al cancelar, conservas el acceso hasta el final del periodo ya pagado. No hay reembolsos de periodos pagados ni parciales.</li>
        <li>Podemos suspender o cancelar una cuenta que incumpla estos términos, avisando al Cliente por correo salvo que el incumplimiento ponga en riesgo el Servicio o a terceros.</li>
      </ul>

      <h2>6. Información del Cliente</h2>
      <ul>
        <li>La información que el Cliente captura (obras, personal, fotografías, remisiones, reportes) es del Cliente. Solo la usamos para prestarle el Servicio, darle soporte y cumplir obligaciones legales.</li>
        <li>El Cliente es responsable de tener el derecho de capturar los datos de su personal y de terceros, incluido su consentimiento cuando la ley lo exija, y de informarles mediante su propio aviso de privacidad.</li>
        <li>El Cliente puede descargar su información en cualquier momento mediante los reportes de la aplicación.</li>
        <li>Al terminar el servicio, conservamos la información 90 días por si el Cliente quiere regresar o descargarla, y después la eliminamos. Puede pedir que la borremos antes escribiendo a {correo}.</li>
      </ul>

      <h2>7. Uso aceptable</h2>
      <p>No está permitido usar el Servicio para fines ilícitos, intentar acceder a cuentas o datos de otros clientes, interferir con su funcionamiento, revenderlo sin autorización ni subir contenido ilegal o malicioso.</p>

      <h2>8. Disponibilidad</h2>
      <p>
        Trabajamos para que el Servicio esté disponible siempre, pero no garantizamos que funcione sin interrupciones ni errores. Puede haber
        mantenimientos y fallas de proveedores. Avisaremos con anticipación de los mantenimientos programados cuando sea posible.
      </p>

      <h2>9. Responsabilidad</h2>
      <p>
        El Servicio es una herramienta de registro y control; las decisiones de obra, pago de personal y compras son del Cliente. En la medida
        que permita la ley, no somos responsables por lucro cesante, pérdida de oportunidades ni daños indirectos. Nuestra responsabilidad
        total frente al Cliente no excederá lo que haya pagado por el Servicio en los 3 meses anteriores al hecho que la origine.
      </p>

      <h2>10. Propiedad intelectual</h2>
      <p>El software, la marca Bitácora y el diseño del Servicio son nuestros. El Cliente recibe un derecho de uso no exclusivo e intransferible mientras su cuenta esté vigente.</p>

      <h2>11. Cambios a estos términos</h2>
      <p>Si los modificamos, avisaremos por correo o dentro de la aplicación al menos 15 días antes de que entren en vigor. Seguir usando el Servicio después de esa fecha implica aceptar los cambios.</p>

      <h2>12. Ley aplicable y tribunales</h2>
      <p>Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a los tribunales competentes de Guadalajara, Jalisco, y renuncian a cualquier otro fuero que pudiera corresponderles por su domicilio presente o futuro.</p>

      <h2>13. Contacto</h2>
      <p>Dudas sobre estos términos: {correo}.</p>
    </Documento>
  );
}

export function Privacidad() {
  return (
    <Documento titulo="Aviso de privacidad">
      <p>
        {RESPONSABLE}, con domicilio en {DOMICILIO}, es responsable del tratamiento de los datos personales que se recaban a través de
        Bitácora, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y su normativa.
      </p>

      <h2>Datos que tratamos como responsables</h2>
      <ul>
        <li>De quien crea la cuenta y de los usuarios: nombre, correo electrónico, contraseña (guardada cifrada, nunca en texto legible), rol en la empresa y fecha de último acceso.</li>
        <li>De la empresa cliente: nombre, giro, cómo se enteró de Bitácora y, si los captura, RFC, dirección, teléfono, correo de contacto y logotipo.</li>
        <li>De pago: plan contratado, fechas y forma de pago. Los datos de tarjeta los recibe y guarda directamente Stripe; nosotros no los vemos ni los almacenamos.</li>
        <li>Técnicos: dirección IP y registros de acceso, usados para seguridad.</li>
      </ul>
      <p>No solicitamos datos personales sensibles.</p>

      <h2>Finalidades</h2>
      <p>Necesarias para el servicio:</p>
      <ul>
        <li>Crear y administrar la cuenta y verificar el correo.</li>
        <li>Prestar el servicio, dar soporte y enviar avisos de la cuenta (invitaciones, recuperación de contraseña, cobro).</li>
        <li>Cobrar, facturar y cumplir obligaciones fiscales y legales.</li>
        <li>Proteger la plataforma contra accesos no autorizados y abusos.</li>
      </ul>
      <p>Adicionales, que no son necesarias para el servicio:</p>
      <ul>
        <li>Elaborar estadísticas internas sobre los giros de nuestros clientes y cómo nos conocieron.</li>
        <li>Enviarte información sobre novedades y promociones de Bitácora.</li>
      </ul>
      <p>Si no quieres que usemos tus datos para las finalidades adicionales, escribe a {correo}. Negarte no afecta tu servicio.</p>

      <h2>Datos que tu empresa captura en Bitácora</h2>
      <p>
        Los datos que el cliente registra sobre su personal y sus obras (por ejemplo nombres, teléfonos, puestos, costo diario, asistencias y
        fotografías de evidencia) son responsabilidad de la empresa cliente. Respecto de ellos actuamos como encargados: solo los tratamos para
        prestarle el servicio y según sus instrucciones. Para ejercer derechos sobre esos datos, el titular debe dirigirse a la empresa que lo
        registró; nosotros la apoyaremos para atender su solicitud.
      </p>

      <h2>Con quién compartimos datos</h2>
      <p>Usamos proveedores que tratan datos por nuestra cuenta, únicamente para prestar el servicio y obligados a protegerlos:</p>
      <ul>
        <li>Supabase: base de datos y almacenamiento de archivos.</li>
        <li>Vercel: alojamiento de la aplicación.</li>
        <li>Stripe: procesamiento de pagos.</li>
        <li>Resend: envío de correos.</li>
      </ul>
      <p>
        Estos proveedores operan servidores fuera de México, principalmente en Estados Unidos. Fuera de ellos, solo compartimos datos con
        autoridades cuando una ley o una orden lo exijan. No vendemos datos personales.
      </p>

      <h2>Tus derechos (ARCO) y revocación del consentimiento</h2>
      <p>
        Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso, así como revocar tu consentimiento o limitar su uso,
        escribiendo a {correo}. Tu solicitud debe incluir tu nombre, un medio para responderte, una identificación (o la de tu representante y
        el documento que lo acredite), la descripción clara de los datos y del derecho que quieres ejercer, y cualquier documento que ayude a
        localizarlos. Te responderemos en un máximo de 20 días hábiles y, si procede, lo haremos efectivo dentro de los 15 días hábiles
        siguientes. Muchos datos de la cuenta también los puedes corregir directamente en la aplicación.
      </p>

      <h2>Almacenamiento en tu navegador</h2>
      <p>Guardamos en el almacenamiento local de tu navegador los datos necesarios para mantener tu sesión abierta. No usamos cookies de publicidad ni herramientas de rastreo de terceros.</p>

      <h2>Conservación</h2>
      <p>Conservamos los datos mientras la cuenta esté vigente y hasta 90 días después de terminado el servicio, salvo los que debamos guardar más tiempo por obligaciones fiscales o legales.</p>

      <h2>Cambios a este aviso</h2>
      <p>Publicaremos cualquier cambio en esta página con su fecha de actualización y, si es relevante, lo avisaremos por correo o dentro de la aplicación.</p>

      <p>Si consideras que tu derecho a la protección de datos ha sido vulnerado, puedes acudir ante la autoridad competente en la materia.</p>
    </Documento>
  );
}
