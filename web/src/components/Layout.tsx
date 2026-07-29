import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

// Navegacion mobile-first (seccion 11): "barra de navegacion inferior fija
// con 3-4 accesos". El Oficial ve una barra de campo; el resto ve la
// operativa/administrativa. Todos comparten el mismo layout responsivo.
const NAV_OFICIAL: NavItem[] = [
  { to: "/mis-obras", label: "Mis obras", icon: "🏗️" },
  { to: "/mis-herramientas", label: "Herramientas", icon: "🧰" },
  { to: "/historial", label: "Historial", icon: "🕒" },
];

const NAV_GESTION: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/obras", label: "Obras", icon: "🏗️" },
  { to: "/personas", label: "Personas", icon: "👷" },
  { to: "/herramientas", label: "Herramientas", icon: "🧰" },
  { to: "/reportes", label: "Reportes", icon: "📑" },
];

export function Layout() {
  const { usuario, logout } = useAuth();
  if (!usuario) return null;

  const items = usuario.rol === "Oficial" ? NAV_OFICIAL : NAV_GESTION;

  return (
    <div className="flex min-h-screen flex-col bg-[#F0F3F4]">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">OBRA/OS · {usuario.tenantNombre}</p>
            <p className="text-sm font-medium text-ink">
              {usuario.personaNombre ?? usuario.email} <span className="text-ink-soft">· {usuario.rol}</span>
            </p>
          </div>
          <button onClick={logout} className="min-h-[44px] rounded-md px-3 text-sm text-accent hover:bg-accent-soft">
            Salir
          </button>
        </div>
        <nav className="mx-auto hidden max-w-5xl gap-1 px-4 pb-2 md:flex">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-accent-soft text-accent-ink" : "text-ink-soft hover:bg-slate-50"}`
              }
            >
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-24 md:pb-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid border-t border-black/10 bg-white md:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs ${isActive ? "text-accent" : "text-ink-soft"}`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
