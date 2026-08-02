import { ComponentType } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  LogoMark,
  IconResumen,
  IconObras,
  IconPersonas,
  IconHerramientas,
  IconReportes,
  IconHistorial,
  IconSeguridad,
  IconEmpresa,
} from "./Icons";

interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}

// Navegacion mobile-first (seccion 11): "barra de navegacion inferior fija
// con 3-4 accesos". El Oficial ve una barra de campo; el resto ve la
// operativa/administrativa. Todos comparten el mismo layout responsivo.
const NAV_OFICIAL: NavItem[] = [
  { to: "/mis-obras", label: "Mis obras", Icon: IconObras },
  { to: "/mis-herramientas", label: "Herramientas", Icon: IconHerramientas },
  { to: "/historial", label: "Historial", Icon: IconHistorial },
];

const NAV_GESTION: NavItem[] = [
  { to: "/", label: "Dashboard", Icon: IconResumen },
  { to: "/obras", label: "Obras", Icon: IconObras },
  { to: "/personas", label: "Personas", Icon: IconPersonas },
  { to: "/herramientas", label: "Herramientas", Icon: IconHerramientas },
  { to: "/reportes", label: "Reportes", Icon: IconReportes },
];

const NAV_ADMIN_EXTRA: NavItem[] = [
  { to: "/empresa", label: "Empresa", Icon: IconEmpresa },
  { to: "/seguridad", label: "Seguridad", Icon: IconSeguridad },
];

export function Layout() {
  const { usuario, logout } = useAuth();
  if (!usuario) return null;

  const items =
    usuario.rol === "Oficial"
      ? NAV_OFICIAL
      : usuario.rol === "Administrador"
        ? [...NAV_GESTION, ...NAV_ADMIN_EXTRA]
        : NAV_GESTION;

  return (
    <div className="flex min-h-screen flex-col bg-[#F1EEE7]">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-6 w-6 shrink-0 text-accent" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">Bitácora · {usuario.tenantNombre}</p>
              <p className="text-sm font-medium text-ink">
                {usuario.personaNombre ?? usuario.email} <span className="text-ink-soft">· {usuario.rol}</span>
              </p>
            </div>
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
                `flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-accent-soft text-accent-ink" : "text-ink-soft hover:bg-slate-50"}`
              }
            >
              <item.Icon className="h-4 w-4" />
              {item.label}
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
            <item.Icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
