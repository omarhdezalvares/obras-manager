import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Obras } from "./pages/Obras";
import { ObraDetail } from "./pages/ObraDetail";
import { Personas } from "./pages/Personas";
import { Herramientas } from "./pages/Herramientas";
import { Reportes } from "./pages/Reportes";
import { MisObras } from "./pages/MisObras";
import { MisHerramientas } from "./pages/MisHerramientas";
import { Historial } from "./pages/Historial";
import { ProcesoSelector } from "./pages/oficial/ProcesoSelector";
import { AsistenciaWizard } from "./pages/oficial/AsistenciaWizard";
import { EvidenciaWizard } from "./pages/oficial/EvidenciaWizard";

function Loading() {
  return <div className="flex min-h-screen items-center justify-center text-ink-soft">Cargando OBRA/OS…</div>;
}

export default function App() {
  const { usuario, loading } = useAuth();

  if (loading) return <Loading />;

  if (!usuario) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const esOficial = usuario.rol === "Oficial";

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={esOficial ? <Navigate to="/mis-obras" replace /> : <Dashboard />} />
        <Route path="/obras" element={<Obras />} />
        <Route path="/obras/:id" element={<ObraDetail />} />
        <Route path="/personas" element={<Personas />} />
        <Route path="/herramientas" element={<Herramientas />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/mis-obras" element={<MisObras />} />
        <Route path="/mis-obras/:obraId" element={<ProcesoSelector />} />
        <Route path="/mis-obras/:obraId/asistencia" element={<AsistenciaWizard />} />
        <Route path="/mis-obras/:obraId/evidencia" element={<EvidenciaWizard />} />
        <Route path="/mis-herramientas" element={<MisHerramientas />} />
        <Route path="/historial" element={<Historial />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
