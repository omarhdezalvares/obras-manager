import { ReactNode, useState } from "react";

// Graficas hechas con elementos HTML (sin librerias). Colores de serie
// validados para daltonismo: azul acero, naranja de seguridad, morado.
export const SERIE = { azul: "#2F6DB0", naranja: "#E0701F", morado: "#8E5BB5" };
const CALOR = ["#F1F1EE", "#C9DCF0", "#8DB5E0", "#2F6DB0"];

const ancho = (pct: number) => `${Math.min(100, Math.max(0, pct))}%`;

function maxBonito(n: number): number {
  if (n <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 2.5, 5, 10].find((m) => m * e >= n) ?? 10) * e;
}

export function SinDatos({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-[#D9D9D4] bg-[#FAFAF8] px-4 py-6 text-center text-sm text-ink-soft">{children}</p>;
}

export function Leyenda({ items }: { items: { nombre: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#3A3F46]">
      {items.map((i) => (
        <span key={i.nombre} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.nombre}
        </span>
      ))}
    </div>
  );
}

// Barra de consumo contra un total (presupuesto, tiempo...). Rojo si pasa del 100%.
export function BarraConsumo({ etiqueta, detalle, pct, alerta, color = SERIE.azul }: { etiqueta: ReactNode; detalle?: ReactNode; pct: number; alerta?: ReactNode; color?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-ink">{etiqueta}</span>
        {detalle && <span className="num shrink-0 text-xs text-ink-soft">{detalle}</span>}
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#ECECE8]" title={`${Math.round(pct)}%`}>
        <div className="h-full rounded-full" style={{ width: ancho(pct), background: pct > 100 ? "#B42318" : color }} />
      </div>
      {alerta && <p className="text-xs font-medium text-crit">▲ {alerta}</p>}
    </div>
  );
}

// Columnas apiladas por dia con eje de 3 marcas y detalle al pasar o tocar.
export function ColumnasApiladas({
  dias,
  series,
  formato,
  titulo,
}: {
  dias: string[];
  series: { nombre: string; color: string; valores: number[] }[];
  formato: (n: number) => string;
  titulo: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const totales = dias.map((_, i) => series.reduce((s, x) => s + (x.valores[i] ?? 0), 0));
  const tope = maxBonito(Math.max(...totales, 0));
  const ALTO = 148;
  if (totales.every((t) => t === 0)) return <SinDatos>Sin gastos en el periodo.</SinDatos>;
  const pico = totales.indexOf(Math.max(...totales));
  const cada = dias.length > 16 ? Math.ceil(dias.length / 8) : 1;

  return (
    <div className="space-y-2">
      <div className="relative flex gap-2" role="img" aria-label={`${titulo}: máximo ${formato(totales[pico])} el ${dias[pico]}`}>
        <div className="num flex flex-col justify-between pb-5 text-right text-[11px] text-[#6B7079]" style={{ height: ALTO + 20 }}>
          <span>{formato(tope)}</span>
          <span>{formato(tope / 2)}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative flex items-end gap-[3px] border-b border-[#CFCFCA] sm:gap-1.5" style={{ height: ALTO }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-[#E6E6E2]" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-[#E6E6E2]" />
            {dias.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-label={`${d}: ${series.map((s) => `${s.nombre} ${formato(s.valores[i] ?? 0)}`).join(", ")}`}
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                onClick={() => setActivo(activo === i ? null : i)}
                className={`relative flex h-full flex-1 flex-col-reverse gap-[2px] rounded-t ${activo === i ? "bg-black/[0.04]" : ""}`}
              >
                {series.map((s, si) => {
                  const v = s.valores[i] ?? 0;
                  const ultimo = series.slice(si + 1).every((x) => !(x.valores[i] ?? 0));
                  return v > 0 ? <span key={s.nombre} className={ultimo ? "rounded-t-[4px]" : ""} style={{ height: (v / tope) * ALTO, background: s.color }} /> : null;
                })}
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-[3px] sm:gap-1.5">
            {dias.map((d, i) => (
              <span key={d} className="num flex-1 text-center text-[11px] text-[#6B7079]">{i % cada === 0 ? Number(d.slice(8)) : ""}</span>
            ))}
          </div>
        </div>
        {activo !== null && (
          <div className="pointer-events-none absolute left-12 top-0 z-10 rounded-md border border-line bg-white px-3 py-2 text-xs shadow-md">
            <p className="font-semibold text-ink">{dias[activo]}</p>
            {series.map((s) => (
              <p key={s.nombre} className="flex items-center gap-1.5 text-ink-soft">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.nombre}: <span className="num text-ink">{formato(s.valores[activo] ?? 0)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-ink-soft">
        Pico: <strong className="num text-ink">{formato(totales[pico])}</strong> el {Number(dias[pico].slice(8))}
      </p>
    </div>
  );
}

// Mapa de calor: filas (obras) por dias, cuatro tonos de un solo azul.
export function MapaCalor({ dias, filas, unidad }: { dias: string[]; filas: { nombre: string; valores: number[] }[]; unidad: string }) {
  if (filas.length === 0) return <SinDatos>No hay obras en el periodo.</SinDatos>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1 text-xs text-ink-soft">
        0{CALOR.map((c) => <span key={c} className="h-3 w-4 rounded-sm border border-black/5" style={{ background: c }} />)}3+
      </div>
      <div className="overflow-x-auto">
        <div className="space-y-1" style={{ minWidth: Math.max(520, 140 + dias.length * 30) }}>
          {filas.map((f) => (
            <div key={f.nombre} className="flex items-center gap-1">
              <span className="w-[140px] shrink-0 truncate pr-2 text-sm font-medium" title={f.nombre}>{f.nombre}</span>
              {f.valores.map((v, i) => (
                <span
                  key={dias[i]}
                  title={`${f.nombre} · ${dias[i]} · ${v} ${unidad}`}
                  className={`num flex h-8 flex-1 items-center justify-center rounded-[3px] text-xs font-semibold ${v >= 3 ? "text-white" : v ? "text-ink" : "text-transparent"}`}
                  style={{ background: CALOR[Math.min(v, 3)] }}
                >
                  {v}
                </span>
              ))}
              <span className="num w-10 shrink-0 text-right text-sm font-semibold">{f.valores.reduce((a, b) => a + b, 0)}</span>
            </div>
          ))}
          <div className="flex gap-1">
            <span className="w-[140px] shrink-0" />
            {dias.map((d) => <span key={d} className="num flex-1 text-center text-[11px] text-[#6B7079]">{Number(d.slice(8))}</span>)}
            <span className="w-10 shrink-0 text-right text-[10px] font-semibold uppercase text-ink-soft">Total</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Barras horizontales con valor y detalle (herramientas por obra, obras por persona).
export function BarrasHorizontales({ items, color = SERIE.azul, vacio }: { items: { nombre: string; valor: number; detalle?: string }[]; color?: string; vacio: string }) {
  const tope = Math.max(...items.map((i) => i.valor), 0);
  if (tope === 0) return <SinDatos>{vacio}</SinDatos>;
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.nombre} className="space-y-1">
          <div className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{i.nombre}</span>
            <span className="num font-semibold">{i.valor}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#ECECE8]">
            <div className="h-full rounded-full" style={{ width: ancho((i.valor / tope) * 100), background: color }} />
          </div>
          {i.detalle && <p className="truncate text-xs text-ink-soft">{i.detalle}</p>}
        </div>
      ))}
    </div>
  );
}

// Una barra partida en segmentos (estado del inventario).
export function BarraSegmentos({ items }: { items: { nombre: string; valor: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.valor, 0);
  if (total === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded" role="img" aria-label={items.map((i) => `${i.nombre} ${i.valor}`).join(", ")}>
        {items.filter((i) => i.valor > 0).map((i) => <span key={i.nombre} title={`${i.nombre}: ${i.valor}`} style={{ flex: i.valor, background: i.color }} />)}
      </div>
      <Leyenda items={items.map((i) => ({ nombre: `${i.nombre} ${i.valor}`, color: i.color }))} />
    </div>
  );
}
