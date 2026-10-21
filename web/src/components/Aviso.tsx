import { useEffect, useState } from "react";

// Aviso breve "Guardado ✓": un solo aviso a la vez, 3 s, encima de la barra movil.
type Oyente = (texto: string) => void;
const oyentes = new Set<Oyente>();

export function mostrarAviso(texto: string) {
  oyentes.forEach((o) => o(texto));
}

export function Avisos() {
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null);
  useEffect(() => {
    const oyente: Oyente = (texto) => setAviso({ texto, id: Date.now() });
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  }, []);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
      {aviso && (
        <p key={aviso.id} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg">
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
