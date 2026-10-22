import { ComponentType } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { MenuDesplegable } from "./MenuDesplegable";
import { useAuth } from "../lib/auth";
import {
  LogoMark,
  IconResumen,
  IconObras,
  IconHerramientas,
  IconConfiguracion,
  IconReportes,
  IconHistorial,
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
  { to: "/reportes", label: "Reportes", Icon: IconReportes },
];

// Catalogos maestros y ajustes: fuera de la barra para que quede corta.
const CONFIG_GESTION = [
  { label: "Personas", to: "/personas" },
  { label: "Herramientas", to: "/herramientas" },
];
const CONFIG_ADMIN = [
  { label: "Empresa", to: "/empresa" },
  { label: "Seguridad", to: "/seguridad" },
];

export function Layout() {
  const { usuario, logout } = useAuth();
  const { pathname } = useLocation();
  if (!usuario) return null;

  const esOficial = usuario.rol === "Oficial";
  const items = esOficial ? NAV_OFICIAL : NAV_GESTION;
  const config = esOficial ? [] : [...CONFIG_GESTION, ...(usuario.rol === "Administrador" ? CONFIG_ADMIN : [])];
  const enConfig = config.some((c) => pathname.startsWith(c.to));

  const nombre = usuario.personaNombre ?? usuario.email;
  const iniciales = nombre.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

  return (
    <div className="flex min-h-screen flex-col bg-ground">
      <header className="sticky top-0 z-10 bg-graphite text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex min-h-[60px] max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-mark">
              <LogoMark className="h-5 w-5 text-graphite" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block font-bold">Bitácora</span>
              <span className="block truncate text-xs text-[#B9BEC6]">{usuario.tenantNombre}</span>
            </span>
          </div>
          <nav aria-label="Principal" className="ml-4 hidden self-stretch md:flex">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 border-b-[3px] px-3.5 text-sm ${isActive ? "border-accent-mark font-semibold text-white" : "border-transparent text-[#C9CDD3] hover:text-white"}`
                }
              >
                <item.Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {config.length > 0 && (
              <MenuDesplegable
                ariaLabel="Configuración"
                className={`hover:bg-white/10 ${enConfig ? "text-white" : "text-[#C9CDD3]"}`}
                etiqueta={
                  <>
                    <IconConfiguracion className="h-5 w-5" />
                    <span className="hidden text-sm sm:inline">Configuración</span>
                  </>
                }
                items={config}
              />
            )}
            <MenuDesplegable
              ariaLabel="Menu de perfil"
              className="hover:bg-white/10"
              etiqueta={
                <>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-graphite-soft text-xs font-semibold">{iniciales}</span>
                  <span className="hidden max-w-[160px] text-left leading-tight lg:block">
                    <span className="block truncate text-sm">{nombre}</span>
                    <span className="block text-xs text-[#B9BEC6]">{usuario.rol}</span>
                  </span>
                </>
              }
              items={[{ label: "Salir", onClick: logout, peligro: true }]}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-5 pb-24 sm:px-6 md:py-7 md:pb-10 lg:px-8">
        <Outlet />
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 grid border-t border-line bg-white md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)`, paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs ${isActive ? "font-semibold text-accent" : "text-ink-soft"}`
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
