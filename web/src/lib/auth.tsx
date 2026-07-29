import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, clearTokens, getAccessToken, setTokens } from "./api";
import { Usuario } from "./types";

interface AuthContextValue {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<Usuario>("/auth/me")
      .then((res) => setUsuario(res.data))
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    setTokens(res.data.accessToken, res.data.refreshToken);
    setUsuario(res.data.usuario);
  }

  function logout() {
    clearTokens();
    setUsuario(null);
  }

  return <AuthContext.Provider value={{ usuario, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

// Roles con vista de campo (mobile-first, seccion 11) vs. roles de escritorio.
export const ROLES_CAMPO: Usuario["rol"][] = ["Oficial"];

// Oficial y Gerente de Proyecto no deben ver ningun dato financiero ni de
// presupuesto en ninguna pantalla (ajuste de negocio posterior al diseno original).
const SIN_ACCESO_FINANCIERO: Usuario["rol"][] = ["Oficial", "Gerente de Proyecto"];
export function puedeVerFinanciero(rol: Usuario["rol"] | undefined): boolean {
  return !!rol && !SIN_ACCESO_FINANCIERO.includes(rol);
}

// Presupuesto/partidas: todos menos Oficial y Gerente (Supervisor y Lectura si ven, solo consulta).
export function puedeVerPresupuesto(rol: Usuario["rol"] | undefined): boolean {
  return puedeVerFinanciero(rol);
}

// Libro de transacciones: mas restringido, Supervisor tampoco lo ve (seccion 06 original: "Ninguno").
export function puedeVerTransacciones(rol: Usuario["rol"] | undefined): boolean {
  return rol === "Administrador" || rol === "Finanzas" || rol === "Solo lectura";
}
