import { useState } from "react";
import { Input } from "./ui";
import { fechaLarga, hoyLocal } from "../lib/fechas";

// En campo casi siempre se registra "hoy": la fecha se muestra como texto y
// el calendario solo aparece si se pide, para no cambiarla por error.
export function FechaHoy({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const esHoy = value === hoyLocal();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-base font-medium text-ink">
        {esHoy ? "Hoy, " : ""}
        {fechaLarga(value)}
      </p>
      {editando ? (
        <Input type="date" className="max-w-[180px]" max={hoyLocal()} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <button type="button" className="min-h-[44px] text-sm text-accent underline-offset-2 hover:underline" onClick={() => setEditando(true)}>
          cambiar fecha
        </button>
      )}
    </div>
  );
}
