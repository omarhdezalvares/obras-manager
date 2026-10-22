import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export interface ItemMenu {
  label: string;
  to?: string;
  onClick?: () => void;
  peligro?: boolean;
}

// Menu simple: abre con clic, cierra con clic fuera, Escape o al elegir.
export function MenuDesplegable({
  etiqueta,
  items,
  ariaLabel,
  alinear = "right",
  className = "",
}: {
  etiqueta: ReactNode;
  items: ItemMenu[];
  ariaLabel?: string;
  alinear?: "left" | "right";
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const claseItem = (peligro?: boolean) =>
    `flex min-h-[44px] w-full items-center px-4 text-left text-sm hover:bg-accent-soft ${peligro ? "text-crit" : "text-ink"}`;

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={ariaLabel}
        onClick={() => setAbierto((v) => !v)}
        className={`flex min-h-[44px] min-w-[44px] max-w-full items-center gap-1.5 rounded-md px-2 ${className}`}
      >
        {etiqueta}
      </button>
      {abierto && (
        <div
          role="menu"
          className={`absolute top-full z-30 mt-1 min-w-[190px] overflow-hidden rounded-md border border-black/10 bg-white py-1 shadow-lg ${
            alinear === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) =>
            item.to ? (
              <Link key={item.label} role="menuitem" to={item.to} onClick={() => setAbierto(false)} className={claseItem(item.peligro)}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setAbierto(false);
                  item.onClick?.();
                }}
                className={claseItem(item.peligro)}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
