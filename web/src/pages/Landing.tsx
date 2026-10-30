import { ReactNode, SVGProps, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconEmpresa, IconHerramientas, IconObras, IconPersonas, IconReportes, IconSeguridad, LogoMark } from "../components/Icons";
import { Demo, useVisible } from "./LandingDemo";

// Pagina publica: historia (problema -> un dia de obra -> demo -> por que Bitacora) -> planes -> registro.
// Precios preliminares del plan de negocios (seccion 3.3), sin IVA.

const btnPrimario =
  "inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-[15px] font-semibold text-white hover:bg-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const btnSecundario =
  "inline-flex items-center justify-center rounded-md border border-graphite/20 px-5 py-3 text-[15px] font-semibold text-ink hover:border-graphite/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const contenedor = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export function Landing() {
  return (
    <div className="landing min-h-screen bg-ground text-ink">
      <Cabecera />
      <main>
        <Portada />
        <Problema />
        <DiaDeObra />
        <section id="demo" className="border-t border-line py-20">
          <div className={contenedor}>
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.01em] sm:text-4xl">Recorre Bitácora por dentro.</h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
              Así se ve con una empresa en marcha. Los datos son de ejemplo; las pantallas y las gráficas son las de la aplicación.
            </p>
            <Demo />
          </div>
        </section>
        <PorQue />
        <Planes />
        <Cierre />
      </main>
      <footer className="border-t border-line py-8">
        <div className={`${contenedor} flex flex-col gap-2 text-sm text-ink-soft sm:flex-row sm:justify-between`}>
          <p>Bitácora, control de obras para contratistas de instalaciones. Guadalajara, Jalisco.</p>
          <Link to="/entrar" className="font-medium text-ink hover:text-accent">Iniciar sesión</Link>
        </div>
      </footer>
    </div>
  );
}

function Cabecera() {
  return (
    <header className="border-b border-line bg-ground/95">
      <div className={`${contenedor} flex h-16 items-center justify-between`}>
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-ink">
          <LogoMark className="h-6 w-6 text-accent" />
          Bitácora
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-4">
          <a href="#demo" className="hidden rounded px-2 py-1 font-medium text-ink-soft hover:text-ink sm:inline">Demo</a>
          <a href="#planes" className="hidden rounded px-2 py-1 font-medium text-ink-soft hover:text-ink sm:inline">Planes</a>
          <Link to="/entrar" className="rounded px-2 py-1 font-medium text-ink-soft hover:text-ink">Iniciar sesión</Link>
          <Link to="/registro" className="rounded-md bg-graphite px-3 py-2 font-semibold text-white hover:bg-graphite-soft">Crear cuenta</Link>
        </nav>
      </div>
    </header>
  );
}

function Portada() {
  return (
    <section className={`${contenedor} grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24`}>
      <div>
        <h1 className="max-w-xl text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] text-ink sm:text-[56px]">
          Sabe hoy cuánto llevas gastado, avanzado y por cobrar en cada obra.
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
          Bitácora junta en el celular la asistencia, los avances con foto, el material y la herramienta de tus cuadrillas.
          Sin esperar al cierre y sin perseguir a nadie por WhatsApp.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/registro" className={btnPrimario}>Prueba 14 días gratis</Link>
          <a href="#demo" className={btnSecundario}>Ver la demo</a>
        </div>
        <p className="mt-4 text-sm text-ink-soft">Sin tarjeta para empezar. Precio por empresa, no por usuario.</p>
      </div>
      <TableroObra />
    </section>
  );
}

// Ilustracion del tablero de una obra: avance contra gasto por partida, con la alerta que el dueno ve el mismo dia.
const PARTIDAS = [
  { nombre: "Canalización", avance: 82, gasto: 74 },
  { nombre: "Cableado estructurado", avance: 40, gasto: 52, alerta: true },
  { nombre: "CCTV y control de acceso", avance: 15, gasto: 11 },
];

// Avance y gasto acumulados (% del total) de las ultimas 8 semanas: el gasto se despega del avance.
const SEMANAS_AVANCE = [4, 11, 19, 26, 32, 37, 42, 46];
const SEMANAS_GASTO = [5, 13, 22, 31, 40, 48, 55, 61];
const linea = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${(i * 460) / 7} ${78 - (v / 62) * 74}`).join(" ");

function TableroObra() {
  // Las barras arrancan en 0 y se llenan al montar (con "reducir movimiento" aparecen llenas).
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setListo(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <figure aria-label="Ejemplo del tablero de una obra en Bitácora" className="rounded-xl bg-graphite p-5 text-white shadow-[0_24px_60px_-24px_rgba(31,35,40,0.55)] sm:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-sm text-white/60">Obra activa</p>
          <p className="text-lg font-semibold">Clínica Zapopan, torre B</p>
        </div>
        <p className="text-right text-sm text-white/60">
          Hoy en obra
          <span className="block text-lg font-semibold text-white">12 de 12</span>
        </p>
      </div>
      <ul className="mt-5 space-y-5">
        {PARTIDAS.map((p, i) => (
          <li key={p.nombre}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{p.nombre}</span>
              <span className="text-white/60">
                {p.avance}% avance · <span className={p.alerta ? "font-semibold text-accent-mark" : ""}>{p.gasto}% gastado</span>
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-white/80 transition-[width] duration-1000 ease-out"
                style={{ width: listo ? `${p.avance}%` : 0, transitionDelay: `${i * 150}ms` }}
              />
            </div>
            <div className="mt-1 h-1 rounded-full bg-white/5">
              <div
                className={`h-1 rounded-full transition-[width] duration-1000 ease-out ${p.alerta ? "bg-accent-mark" : "bg-white/35"}`}
                style={{ width: listo ? `${p.gasto}%` : 0, transitionDelay: `${i * 150 + 250}ms` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>Últimas 8 semanas, acumulado</span>
          <span className="flex gap-3">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-white/80" />Avance</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-accent-mark" />Gasto</span>
          </span>
        </div>
        <svg viewBox="0 0 460 80" preserveAspectRatio="none" className="mt-2 h-20 w-full overflow-visible" role="img" aria-label="El gasto acumulado pasó de 5% a 61% mientras el avance llegó a 46%">
          <path d="M0 78 H460" stroke="rgba(255,255,255,0.12)" />
          <path className="trazo" pathLength={1} d={linea(SEMANAS_AVANCE)} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path className="trazo" pathLength={1} d={linea(SEMANAS_GASTO)} fill="none" stroke="#E0701F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="mt-4 rounded-lg border-l-4 border-accent-mark bg-white/5 px-4 py-3 text-sm">
        <p className="font-semibold">Cableado va 12 puntos más gastado que avanzado</p>
        <p className="mt-0.5 text-white/60">3 remisiones de cable UTP esta semana sin avance registrado.</p>
      </div>
      <figcaption className="sr-only">
        Tablero de ejemplo: la partida de cableado lleva 40% de avance y 52% del presupuesto gastado, por eso aparece una alerta.
      </figcaption>
    </figure>
  );
}

type Icono = (p: SVGProps<SVGSVGElement>) => JSX.Element;
const trazoIcono = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IconCaja: Icono = (p) => (
  <svg {...trazoIcono} {...p}><path d="M3 8l9-4 9 4v9l-9 4-9-4z" /><path d="M3 8l9 4 9-4M12 12v9" /></svg>
);
const IconEstimacion: Icono = (p) => (
  <svg {...trazoIcono} {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h6M9 16h4" /></svg>
);
const IconCamara: Icono = (p) => (
  <svg {...trazoIcono} {...p}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
const IconAlarma: Icono = (p) => (
  <svg {...trazoIcono} {...p}><circle cx="12" cy="13" r="7" /><path d="M12 9v4l2.5 2M5 4L2.5 6.5M19 4l2.5 2.5" /></svg>
);
const IconLista: Icono = (p) => (
  <svg {...trazoIcono} {...p}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg>
);

const PROBLEMAS: { titulo: string; texto: string; icono: Icono }[] = [
  {
    titulo: "El material sale y nadie sabe a dónde",
    texto: "Salidas de almacén sin remisión, consumos arriba de lo presupuestado y horas pagadas que no se trabajaron. En una obra con 15% de margen, una fuga de 3% se come la quinta parte de la utilidad.",
    icono: IconCaja,
  },
  {
    titulo: "Las estimaciones se atoran",
    texto: "Sin fotos con fecha ni avance por partida, el cliente o la constructora rechaza o retrasa el cobro.",
    icono: IconEstimacion,
  },
  {
    titulo: "¿Quién tiene la fusionadora?",
    texto: "La herramienta pasa de mano en mano y cuando se pierde, la reposición sale de tu bolsa.",
    icono: IconHerramientas,
  },
  {
    titulo: "Te enteras cuando ya terminó",
    texto: "La información llega por WhatsApp y se captura en Excel días después. Para entonces, la obra ya perdió dinero.",
    icono: IconAlarma,
  },
];

function Problema() {
  return (
    <section className="border-y border-line bg-white py-20">
      <div className={`${contenedor} grid gap-12 lg:grid-cols-[1fr_1.4fr]`}>
        <div>
          <h2 className="text-3xl font-semibold leading-tight tracking-[-0.01em] sm:text-4xl">Así se va el dinero en una obra hoy.</h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
            Varias obras a la vez, cuadrillas dispersas y todo pasando por fotos sueltas, listas en papel y mensajes.
          </p>
          <Fuga />
        </div>
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {PROBLEMAS.map((p) => (
            <div key={p.titulo} className="border-t-2 border-graphite pt-4">
              <p.icono aria-hidden className="h-7 w-7 text-accent" />
              <dt className="mt-3 text-lg font-semibold">{p.titulo}</dt>
              <dd className="mt-2 leading-relaxed text-ink-soft">{p.texto}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// Grafica del ejemplo del texto: de 15% de margen, 3 puntos de fuga se llevan la quinta parte.
function Fuga() {
  const { ref, visible } = useVisible<HTMLDivElement>();
  return (
    <div ref={ref} className="mt-10 max-w-md rounded-lg bg-ground p-5">
      <p className="text-sm font-semibold">Utilidad de una obra de $1,000,000 con 15% de margen</p>
      <div className="mt-4 flex h-9 overflow-hidden rounded" role="img" aria-label="Utilidad esperada $150,000; la fuga de 3% se lleva $30,000 y quedan $120,000">
        <span className="flex items-center bg-graphite pl-3 text-xs font-semibold text-white transition-[flex-grow] duration-1000 ease-out" style={{ flexGrow: visible ? 12 : 15 }}>
          $120,000
        </span>
        <span
          className="flex items-center justify-center bg-accent-mark text-xs font-semibold text-graphite transition-[flex-grow,opacity] duration-1000 ease-out"
          style={{ flexGrow: visible ? 3 : 0, opacity: visible ? 1 : 0 }}
        >
          −$30k
        </span>
      </div>
      <p className="mt-3 text-sm text-ink-soft">De $150,000 esperados, una fuga de 3% se lleva $30,000 sin que nadie lo note.</p>
    </div>
  );
}

const DIA: { hora: string; titulo: string; texto: string; icono: Icono }[] = [
  { hora: "7:30", titulo: "El residente pasa lista desde el celular", texto: "Cada asistencia se convierte sola en costo de mano de obra de la obra.", icono: IconLista },
  { hora: "12:00", titulo: "Registra el avance con fotos", texto: "Porcentaje por partida con evidencia fechada: el respaldo que pide tu cliente para pagar la estimación.", icono: IconCamara },
  { hora: "15:00", titulo: "Sale material con remisión", texto: "Ligada a la obra y a la partida. Si se pasa de lo presupuestado, Bitácora avisa.", icono: IconCaja },
  { hora: "18:00", titulo: "La herramienta regresa con su responsable", texto: "Cada equipo tiene un dueño a la vez y su historial completo.", icono: IconHerramientas },
  { hora: "19:00", titulo: "Tú ves los números del día", texto: "Gastado contra avanzado en cada obra, sin llamar a nadie. Y si hace falta, un reporte en Excel.", icono: IconReportes },
];

// La linea del dia se llena y cada hora se enciende en orden cuando la seccion entra a la pantalla.
function DiaDeObra() {
  const { ref, visible } = useVisible<HTMLOListElement>();
  return (
    <section className="py-20">
      <div className={contenedor}>
        <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.01em] sm:text-4xl">Un día de obra con Bitácora.</h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
          Lo que pasa en campo queda registrado en el momento, por quien lo hizo. En la oficina ya no se captura nada dos veces.
        </p>
        <ol ref={ref} className="relative mt-12 max-w-3xl">
          {DIA.map((d, i) => (
            <li key={d.hora} className="relative grid grid-cols-[3rem_1fr] gap-4 pb-10 last:pb-0 sm:gap-6">
              {i < DIA.length - 1 && (
                <span aria-hidden className="absolute bottom-0 left-[1.45rem] top-12 w-0.5 bg-line">
                  <span
                    className="block h-full w-full origin-top bg-accent-mark transition-transform duration-500 ease-out"
                    style={{ transform: `scaleY(${visible ? 1 : 0})`, transitionDelay: `${i * 420 + 200}ms` }}
                  />
                </span>
              )}
              <span
                className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors duration-500 ${visible ? "border-accent-mark bg-white text-accent" : "border-line bg-ground text-ink-soft"}`}
                style={{ transitionDelay: `${i * 420}ms` }}
              >
                <d.icono aria-hidden className="h-5 w-5" />
              </span>
              <div className="pt-1">
                <p className="font-mono text-sm font-semibold text-accent">{d.hora}</p>
                <h3 className="mt-0.5 text-xl font-semibold">{d.titulo}</h3>
                <p className="mt-1.5 max-w-xl leading-relaxed text-ink-soft">{d.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const RAZONES: { titulo: string; texto: string; icono: Icono }[] = [
  { titulo: "Pagas por empresa, no por usuario", texto: "Todas tus cuadrillas pueden usarla sin que el costo crezca con cada residente.", icono: IconPersonas },
  { titulo: "En español y en pesos", texto: "Pensada para el instalador mexicano: eléctrico, voz y datos, CCTV, audio y video.", icono: IconEmpresa },
  { titulo: "Te ayudamos a arrancar", texto: "En Jalisco vamos a tu obra, cargamos tu primer presupuesto y capacitamos a tus residentes.", icono: IconObras },
  { titulo: "Cada quien ve lo suyo", texto: "El oficial ve sus obras; el dinero lo ven el dueño y administración. Tus datos, aislados de otras empresas.", icono: IconSeguridad },
];

function PorQue() {
  return (
    <section className="bg-graphite py-20 text-white">
      <div className={contenedor}>
        <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.01em] sm:text-4xl">
          Nació en una empresa de instalaciones, no en una oficina.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">
          Una contratista de Guadalajara la usa todos los días en sus obras. Las plataformas grandes cobran en dólares por usuario
          y están hechas para constructoras; Bitácora está hecha para la cuadrilla.
        </p>
        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {RAZONES.map((r) => (
            <div key={r.titulo}>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
                <r.icono aria-hidden className="h-6 w-6 text-accent-mark" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{r.titulo}</h3>
              <p className="mt-2 leading-relaxed text-white/70">{r.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PLANES: { nombre: string; precio: string; para: string; incluye: string[]; destacado?: boolean }[] = [
  { nombre: "Básico", precio: "1,290", para: "Para arrancar con tus primeras obras.", incluye: ["Hasta 3 obras activas", "Hasta 10 usuarios", "Soporte por WhatsApp"] },
  {
    nombre: "Profesional",
    precio: "2,690",
    para: "Para la empresa que ya lleva varias obras a la vez.",
    incluye: ["Hasta 10 obras activas", "Hasta 30 usuarios", "Reportes avanzados", "Control de herramientas"],
    destacado: true,
  },
  {
    nombre: "Empresa",
    precio: "5,490",
    para: "Para operaciones grandes o con varias especialidades.",
    incluye: ["Obras y usuarios ilimitados", "Soporte prioritario", "Capacitación cada trimestre"],
  },
];

function Planes() {
  return (
    <section id="planes" className="scroll-mt-4 py-20">
      <div className={contenedor}>
        <h2 className="text-3xl font-semibold leading-tight tracking-[-0.01em] sm:text-4xl">Planes</h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
          Todos incluyen 14 días de prueba gratis. Paga al año y llévate dos meses sin costo.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {PLANES.map((p) => (
            <Plan key={p.nombre} {...p} />
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-soft">
          Precios mensuales en pesos mexicanos, más IVA. Implementación opcional en sitio: $2,500 una sola vez (visita, carga inicial y capacitación).
        </p>
      </div>
    </section>
  );
}

function Plan({ nombre, precio, para, incluye, destacado }: { nombre: string; precio: string; para: string; incluye: string[]; destacado?: boolean }) {
  const oscuro = !!destacado;
  return (
    <div className={`flex flex-col rounded-xl p-7 ${oscuro ? "bg-graphite text-white ring-2 ring-accent-mark" : "border border-line bg-white"}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xl font-semibold">{nombre}</h3>
        {destacado && <span className="rounded bg-accent-mark px-2 py-0.5 text-xs font-semibold text-graphite">Recomendado</span>}
      </div>
      <p className={`mt-2 text-sm ${oscuro ? "text-white/70" : "text-ink-soft"}`}>{para}</p>
      <p className="mt-6">
        <span className="text-4xl font-semibold tracking-[-0.02em]">${precio}</span>
        <span className={`ml-1 text-sm ${oscuro ? "text-white/70" : "text-ink-soft"}`}>/ mes + IVA</span>
      </p>
      <ul className="mt-6 flex-1 space-y-2.5 text-[15px]">
        {incluye.map((i) => (
          <li key={i} className="flex gap-2.5">
            <Palomita oscuro={oscuro} />
            {i}
          </li>
        ))}
      </ul>
      <Link
        to="/registro"
        className={`mt-8 ${oscuro ? btnPrimario : "inline-flex items-center justify-center rounded-md bg-graphite px-5 py-3 text-[15px] font-semibold text-white hover:bg-graphite-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"}`}
      >
        Empezar prueba gratis
      </Link>
    </div>
  );
}

function Palomita({ oscuro }: { oscuro: boolean }): ReactNode {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`mt-1 h-4 w-4 flex-none ${oscuro ? "text-accent-mark" : "text-accent"}`} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cierre() {
  return (
    <section className="border-t border-line bg-white py-20">
      <div className={`${contenedor} flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.01em] sm:text-4xl">Tu próxima obra, con los números al día.</h2>
          <p className="mt-3 text-lg text-ink-soft">Crea la cuenta de tu empresa en dos minutos e invita a tu equipo.</p>
        </div>
        <Link to="/registro" className={btnPrimario}>Crear cuenta gratis</Link>
      </div>
    </section>
  );
}
