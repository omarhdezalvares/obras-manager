import { ReactNode } from "react";

// Renglon de "lo que falta hoy": palomita verde si ya esta, circulo ambar si falta.
export function Estado({ listo, children }: { listo: boolean; children: ReactNode }) {
  return (
    <p className={`flex items-center gap-2.5 text-[15px] ${listo ? "text-ink" : "font-medium text-warn"}`}>
      {listo ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
        </span>
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full border-2 border-warn-mark" aria-hidden="true" />
      )}
      {children}
    </p>
  );
}
