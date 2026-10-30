import { ReactNode, useEffect, useRef, useState } from "react";
import { BarraConsumo, BarraSegmentos, ColumnasApiladas, Leyenda, MapaCalor, SERIE } from "../components/graficas";
import { IconHerramientas, IconObras, IconPersonas, IconReportes, IconResumen, LogoMark } from "../components/Icons";

// Demo de la landing con las graficas reales de la app y datos de ejemplo.
// Cambia de pestana sola hasta que el visitante toca una; con "reducir movimiento" no avanza sola.

const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const DIAS = Array.from({ length: 14 }, (_, i) => `2026-10-${String(17 + i).padStart(2, "0")}`);

// Aparece una vez cuando el elemento entra a la pantalla.
export function useVisible<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setVisible(true);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

type Icono = (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
const PESTANAS: { id: string; titulo: string; texto: string; icono: Icono; vista: () => JSX.Element }[] = [
  { id: "tablero", titulo: "Tablero", texto: "Todas tus obras y el gasto del día en una sola pantalla.", icono: IconResumen, vista: Tablero },
  { id: "presupuesto", titulo: "Presupuesto", texto: "Cada partida contra lo gastado, con alerta al pasarse.", icono: IconObras, vista: Presupuesto },
  { id: "asistencia", titulo: "Asistencia", texto: "El residente pasa lista y el costo se calcula solo. Pruébalo.", icono: IconPersonas, vista: Asistencia },
  { id: "avances", titulo: "Avances", texto: "Porcentaje por partida con fotos fechadas. Mueve el avance.", icono: IconCamara, vista: Avances },
  { id: "herramientas", titulo: "Herramientas", texto: "Quién tiene cada equipo y dónde está.", icono: IconHerramientas, vista: Herramientas },
  { id: "reportes", titulo: "Reportes", texto: "Personal por obra y día, listo para exportar a Excel.", icono: IconReportes, vista: Reportes },
];
const DURACION_MS = 7000;

export function Demo() {
  const [activa, setActiva] = useState(0);
  const [manual, setManual] = useState(false);
  const [pausa, setPausa] = useState(false);
  const { ref, visible } = useVisible<HTMLDivElement>();
  const p = PESTANAS[activa];
  const Vista = p.vista;

  function elegir(i: number) {
    setManual(true);
    setActiva(i);
  }

  return (
    <div
      ref={ref}
      className="mt-12 grid gap-6 lg:grid-cols-[17rem_1fr] lg:gap-10"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onFocusCapture={() => setPausa(true)}
      onBlurCapture={() => setPausa(false)}
    >
      <div role="tablist" aria-label="Secciones de Bitácora" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {PESTANAS.map((t, i) => {
          const sel = i === activa;
          const Ico = t.icono;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`tab-${t.id}`}
              aria-selected={sel}
              aria-controls="demo-panel"
              onClick={() => elegir(i)}
              className={`relative flex shrink-0 items-start gap-3 overflow-hidden rounded-lg px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent lg:shrink ${sel ? "bg-white shadow-sm ring-1 ring-line" : "hover:bg-white/60"}`}
            >
              <Ico className={`mt-0.5 h-5 w-5 flex-none ${sel ? "text-accent" : "text-ink-soft"}`} />
              <span>
                <span className={`block font-semibold ${sel ? "text-ink" : "text-ink-soft"}`}>{t.titulo}</span>
                <span className={`hidden text-sm leading-snug text-ink-soft ${sel ? "lg:block" : ""}`}>{t.texto}</span>
              </span>
              {sel && visible && !manual && (
                <span
                  key={activa}
                  aria-hidden
                  className="progreso absolute inset-x-0 bottom-0 h-0.5 bg-accent-mark"
                  style={{ animationDuration: `${DURACION_MS}ms`, animationPlayState: pausa ? "paused" : "running" }}
                  onAnimationEnd={() => setActiva((a) => (a + 1) % PESTANAS.length)}
                />
              )}
            </button>
          );
        })}
      </div>

      <div id="demo-panel" role="tabpanel" aria-labelledby={`tab-${p.id}`} className="min-w-0 lg:min-h-[38rem]">
        <p className="mb-3 text-sm text-ink-soft lg:hidden">{p.texto}</p>
        <div key={p.id} className="aparece">
          <Vista />
        </div>
      </div>
    </div>
  );
}

// ---------- Marcos ----------

const MENU: [Icono, string][] = [[IconResumen, "tablero"], [IconObras, "presupuesto"], [IconPersonas, "personas"], [IconHerramientas, "herramientas"], [IconReportes, "reportes"]];

function Navegador({ ruta, activo, children }: { ruta: string; activo: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_24px_60px_-30px_rgba(31,35,40,0.45)]">
      <div className="flex items-center gap-3 border-b border-line bg-[#FAFAF8] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#DAD9D4]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#DAD9D4]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#DAD9D4]" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded bg-white px-3 py-1 text-xs text-ink-soft ring-1 ring-line">/{ruta}</span>
      </div>
      <div className="flex min-h-[26rem]">
        <nav aria-hidden className="hidden w-14 flex-none flex-col items-center gap-4 bg-graphite py-4 sm:flex">
          <LogoMark className="h-6 w-6 text-accent-mark" />
          {MENU.map(([Ico, id]) => (
            <span key={id} className={`rounded-md p-1.5 ${id === activo ? "bg-white/15 text-white" : "text-white/50"}`}>
              <Ico className="h-5 w-5" />
            </span>
          ))}
        </nav>
        <div className="min-w-0 flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function Celular({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex justify-center rounded-xl bg-[#E9E9E5] px-4 py-8">
      <div className="w-full max-w-[19rem] rounded-[2.2rem] bg-graphite p-2.5 shadow-[0_30px_60px_-25px_rgba(31,35,40,0.6)]">
        <div className="overflow-hidden rounded-[1.7rem] bg-ground">
          <div className="flex items-center justify-between bg-graphite px-5 pb-3 pt-4 text-white">
            <span className="text-sm font-semibold">{titulo}</span>
            <LogoMark className="h-5 w-5 text-accent-mark" />
          </div>
          <div className="min-h-[24rem] p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: "crit" }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs text-ink-soft">{etiqueta}</p>
      <p className={`num mt-1 text-lg font-semibold ${tono === "crit" ? "text-crit" : "text-ink"}`}>{valor}</p>
    </div>
  );
}

// ---------- Vistas ----------

function Tablero() {
  const mano = [9, 11, 10, 0, 12, 13, 12, 11, 0, 12, 14, 13, 12, 13].map((v) => v * 1000);
  const material = [4, 18, 2, 0, 6, 22, 3, 9, 0, 5, 26, 4, 7, 11].map((v) => v * 1000);
  const otros = [1, 2, 1, 0, 3, 1, 2, 1, 0, 2, 1, 3, 1, 2].map((v) => v * 1000);
  return (
    <Navegador ruta="" activo="tablero">
      <p className="text-lg font-semibold">Buenos días</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi etiqueta="Obras activas" valor="6" />
        <Kpi etiqueta="Gastado hoy" valor={pesos(48320)} />
        <Kpi etiqueta="Personal en obra" valor="37" />
        <Kpi etiqueta="Alertas" valor="2" tono="crit" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="mb-2 text-sm font-semibold">Gasto por día</p>
          <ColumnasApiladas
            titulo="Gasto por día"
            dias={DIAS}
            formato={(n) => `$${Math.round(n / 1000)}k`}
            series={[
              { nombre: "Mano de obra", color: SERIE.azul, valores: mano },
              { nombre: "Material", color: SERIE.naranja, valores: material },
              { nombre: "Otros", color: SERIE.morado, valores: otros },
            ]}
          />
          <div className="mt-2">
            <Leyenda items={[{ nombre: "Mano de obra", color: SERIE.azul }, { nombre: "Material", color: SERIE.naranja }, { nombre: "Otros", color: SERIE.morado }]} />
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-sm font-semibold">Presupuesto por obra</p>
          <BarraConsumo etiqueta="Clínica Zapopan, torre B" detalle="61%" pct={61} />
          <BarraConsumo etiqueta="Plaza Andares, local 14" detalle="88%" pct={88} />
          <BarraConsumo etiqueta="Bodega El Salto" detalle="104%" pct={104} alerta="Se pasó 4% del presupuesto" />
          <BarraConsumo etiqueta="Escuela Tlaquepaque" detalle="23%" pct={23} />
        </div>
      </div>
    </Navegador>
  );
}

function Presupuesto() {
  const partidas = [
    { nombre: "Canalización y tubería", presupuesto: 186000, gastado: 137600 },
    { nombre: "Cableado estructurado", presupuesto: 214000, gastado: 111300 },
    { nombre: "CCTV y control de acceso", presupuesto: 128500, gastado: 14100 },
    { nombre: "Tableros y protecciones", presupuesto: 96000, gastado: 99800 },
  ];
  return (
    <Navegador ruta="obras/clinica-zapopan" activo="presupuesto">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">Clínica Zapopan, torre B</p>
          <p className="text-sm text-ink-soft">Presupuesto {pesos(624500)} · 4 partidas</p>
        </div>
        <span className="rounded bg-crit-soft px-2 py-0.5 text-xs font-semibold text-crit">1 partida excedida</span>
      </div>
      <div className="mt-6 space-y-5">
        {partidas.map((p) => {
          const pct = (p.gastado / p.presupuesto) * 100;
          return (
            <BarraConsumo
              key={p.nombre}
              etiqueta={p.nombre}
              detalle={`${pesos(p.gastado)} de ${pesos(p.presupuesto)}`}
              pct={pct}
              color={SERIE.naranja}
              alerta={pct > 100 ? `Excedida por ${pesos(p.gastado - p.presupuesto)}: 2 remisiones de interruptores` : undefined}
            />
          );
        })}
      </div>
      <div className="mt-6 rounded-lg bg-ground p-4 text-sm">
        <p className="font-semibold">Última remisión</p>
        <p className="mt-1 text-ink-soft">REM-0418 · 12 interruptores QO 20A → Tableros y protecciones · hoy 15:02</p>
      </div>
    </Navegador>
  );
}

const CUADRILLA = [
  { nombre: "Iván Ramírez", puesto: "Oficial electricista", jornal: 900 },
  { nombre: "José Luis Mora", puesto: "Oficial electricista", jornal: 900 },
  { nombre: "Ricardo Peña", puesto: "Técnico de redes", jornal: 850 },
  { nombre: "Martín Cázares", puesto: "Ayudante", jornal: 600 },
  { nombre: "Luis Ángel Ortiz", puesto: "Ayudante", jornal: 600 },
];

function Asistencia() {
  const [presentes, setPresentes] = useState<boolean[]>([true, true, true, false, true]);
  const costo = CUADRILLA.reduce((s, p, i) => s + (presentes[i] ? p.jornal : 0), 0);
  return (
    <Celular titulo="Pasar lista">
      <p className="text-xs text-ink-soft">Clínica Zapopan · jueves 30 oct</p>
      <ul className="mt-3 space-y-2">
        {CUADRILLA.map((p, i) => (
          <li key={p.nombre}>
            <button
              type="button"
              aria-pressed={presentes[i]}
              onClick={() => setPresentes((v) => v.map((x, j) => (j === i ? !x : x)))}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${presentes[i] ? "border-ok/30 bg-ok-soft" : "border-line bg-white"}`}
            >
              <span>
                <span className="block text-sm font-semibold">{p.nombre}</span>
                <span className="block text-xs text-ink-soft">{p.puesto}</span>
              </span>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${presentes[i] ? "bg-ok text-white" : "border border-line text-transparent"}`}>✓</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between rounded-lg bg-graphite px-4 py-3 text-white">
        <span className="text-xs text-white/70">{presentes.filter(Boolean).length} en obra · costo del día</span>
        <span className="num text-lg font-semibold">{pesos(costo)}</span>
      </div>
    </Celular>
  );
}

const FOTOS = [
  { hora: "09:12", tono: "from-[#5B6672] to-[#2E353D]" },
  { hora: "11:40", tono: "from-[#8A7A63] to-[#4A4033]" },
  { hora: "12:05", tono: "from-[#6E7F86] to-[#36454C]" },
];

function Avances() {
  const [avance, setAvance] = useState(40);
  const [guardado, setGuardado] = useState(false);
  return (
    <Celular titulo="Registrar avance">
      <label className="text-xs text-ink-soft" htmlFor="demo-partida">Partida</label>
      <p id="demo-partida" className="mt-1 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold">Cableado estructurado</p>
      <div className="mt-4 flex items-baseline justify-between">
        <label htmlFor="demo-avance" className="text-xs text-ink-soft">Avance</label>
        <span className="num text-2xl font-semibold text-accent">{avance}%</span>
      </div>
      <input
        id="demo-avance"
        type="range"
        min={0}
        max={100}
        step={5}
        value={avance}
        onChange={(e) => {
          setAvance(Number(e.target.value));
          setGuardado(false);
        }}
        className="mt-1 w-full accent-[#B4500C]"
      />
      <p className="mt-4 text-xs text-ink-soft">Evidencia ({FOTOS.length} fotos)</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {FOTOS.map((f) => (
          <div key={f.hora} className={`relative aspect-square overflow-hidden rounded-md bg-gradient-to-br ${f.tono}`}>
            <svg aria-hidden viewBox="0 0 60 60" className="absolute inset-0 h-full w-full text-white/25" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M0 44 L18 30 L30 38 L44 24 L60 34" />
              <path d="M8 12 H52 M8 18 H40" />
            </svg>
            <span className="num absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">{f.hora}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setGuardado(true)}
        className="mt-4 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white"
      >
        {guardado ? "Avance guardado ✓" : "Guardar avance"}
      </button>
    </Celular>
  );
}

function Herramientas() {
  const lista = [
    { nombre: "Fusionadora Fujikura 41S", quien: "Ricardo Peña", donde: "Plaza Andares", estado: "En obra" },
    { nombre: "Rotomartillo DeWalt D25263", quien: "Iván Ramírez", donde: "Clínica Zapopan", estado: "En obra" },
    { nombre: "Certificador Fluke DSX", quien: "—", donde: "Almacén", estado: "Disponible" },
    { nombre: "Escalera de tijera 3 m", quien: "Martín Cázares", donde: "Bodega El Salto", estado: "En obra" },
    { nombre: "Ponchadora RJ45 Klein", quien: "—", donde: "Taller", estado: "Reparación" },
  ];
  const tono: Record<string, string> = { "En obra": "bg-steel-soft text-steel-ink", Disponible: "bg-ok-soft text-ok", "Reparación": "bg-warn-soft text-warn" };
  return (
    <Navegador ruta="herramientas" activo="herramientas">
      <p className="text-lg font-semibold">Herramientas</p>
      <div className="mt-4">
        <BarraSegmentos items={[{ nombre: "En obra", valor: 18, color: SERIE.azul }, { nombre: "Disponibles", valor: 9, color: "#1E7A46" }, { nombre: "Reparación", valor: 2, color: "#C26A00" }]} />
      </div>
      <ul className="mt-5 divide-y divide-line rounded-lg border border-line">
        {lista.map((h) => (
          <li key={h.nombre} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{h.nombre}</span>
              <span className="block text-xs text-ink-soft">{h.quien} · {h.donde}</span>
            </span>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${tono[h.estado]}`}>{h.estado}</span>
          </li>
        ))}
      </ul>
    </Navegador>
  );
}

function Reportes() {
  const dias = DIAS.slice(4);
  return (
    <Navegador ruta="reportes" activo="reportes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Personal por obra y día</p>
          <p className="text-sm text-ink-soft">Del 21 al 30 de octubre</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm font-semibold">
          <IconReportes className="h-4 w-4 text-ok" /> Exportar a Excel
        </span>
      </div>
      <div className="mt-6">
        <MapaCalor
          dias={dias}
          unidad="personas"
          filas={[
            { nombre: "Clínica Zapopan", valores: [5, 5, 0, 4, 5, 5, 4, 0, 5, 5] },
            { nombre: "Plaza Andares", valores: [3, 3, 0, 2, 3, 3, 3, 0, 2, 3] },
            { nombre: "Bodega El Salto", valores: [2, 1, 0, 2, 2, 1, 2, 0, 2, 2] },
            { nombre: "Escuela Tlaquepaque", valores: [0, 1, 0, 1, 1, 0, 1, 0, 1, 1] },
          ]}
        />
      </div>
    </Navegador>
  );
}

function IconCamara(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
