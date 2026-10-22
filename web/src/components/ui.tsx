import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-white p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "crit" | "info";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[#EDEDEA] text-[#3A3F46]",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    crit: "bg-crit-soft text-crit",
    info: "bg-steel-soft text-steel-ink",
  };
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const variants: Record<string, string> = {
    primary: "bg-accent text-white hover:bg-accent-ink disabled:bg-accent/50",
    secondary: "bg-white text-ink border border-[#CFCFCA] hover:bg-ground",
    danger: "bg-crit text-white hover:opacity-90",
    ghost: "bg-transparent text-accent hover:bg-accent-soft",
  };
  return (
    <button
      className={`min-h-[44px] rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const campo = "min-h-[44px] w-full rounded-md border border-[#CFCFCA] bg-white px-3 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${campo} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${campo} py-2 ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${campo} ${props.className ?? ""}`} />;
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">{children}</label>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-[#D9D9D4] bg-white/60 p-8 text-center text-sm text-ink-soft">{children}</div>;
}

// Indicador: etiqueta, cifra grande y una nota con tono.
export function Kpi({ label, valor, nota, tono = "neutral" }: { label: string; valor: ReactNode; nota?: ReactNode; tono?: "neutral" | "ok" | "warn" | "crit" }) {
  const tonos = { neutral: "text-ink-soft", ok: "text-ok", warn: "text-warn", crit: "text-crit" };
  return (
    <div className="flex min-w-[168px] flex-1 shrink-0 snap-start flex-col gap-1 rounded-lg border border-line bg-white px-4 py-3 lg:min-w-0">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      {/* La cifra baja de tamano en 1024-1279px, donde caben 5-6 tarjetas en una fila. */}
      <span className="num whitespace-nowrap text-xl font-semibold leading-tight text-ink lg:text-lg xl:text-2xl">{valor}</span>
      {nota && <span className={`text-xs ${tonos[tono]}`}>{nota}</span>}
    </div>
  );
}

// Fila de indicadores: una sola fila. Hasta 1024px se desliza de lado (las
// tarjetas no caben a lo ancho); desde ahi es una cuadricula de columnas iguales.
export function FilaKpis({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Indicadores" className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:auto-cols-fr lg:grid-flow-col lg:gap-4 lg:overflow-visible lg:px-0">
      {children}
    </section>
  );
}

// Lista dentro de una sola tarjeta: encabezado y filas divididas por lineas.
export function ListaCard({ titulo, subtitulo, accion, children, className = "" }: { titulo?: ReactNode; subtitulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-lg border border-line bg-white ${className}`}>
      {(titulo || accion) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {titulo && <h2 className="text-base font-semibold text-ink">{titulo}</h2>}
            {subtitulo && <p className="text-xs text-ink-soft">{subtitulo}</p>}
          </div>
          {accion}
        </div>
      )}
      <div className="divide-y divide-[#EDEDEA] border-t border-[#EDEDEA]">{children}</div>
    </section>
  );
}

export function Fila({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-h-[44px] items-center gap-3 px-4 py-3 sm:px-5 ${className}`}>{children}</div>;
}

// Tabla ancha: se desplaza dentro de su tarjeta en celular, nunca la pagina.
export function Tabla({ children, minWidth = 640 }: { children: ReactNode; minWidth?: number }) {
  return (
    // relative: lo posicionado dentro (p.ej. sr-only) se queda en la caja con scroll y no ensancha la pagina.
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export const th = "whitespace-nowrap bg-[#FAFAF8] px-4 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-soft sm:px-5";
export const td = "border-t border-[#EDEDEA] px-4 py-3 align-middle sm:px-5";

export function Encabezado({ titulo, subtitulo, accion }: { titulo: ReactNode; subtitulo?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-sm text-ink-soft">{subtitulo}</p>}
      </div>
      {accion}
    </div>
  );
}

// Para listas con contenido propio (no Fila): contenedor unico y filas divididas.
export const lista = "divide-y divide-[#EDEDEA] overflow-hidden rounded-lg border border-line bg-white";
export const filaLista = "px-4 py-3 sm:px-5";
