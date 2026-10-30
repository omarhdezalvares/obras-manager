import { FormEvent, ReactNode, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, apiErrorMessage } from "../lib/api";
import { Button, Input, Label } from "../components/ui";
import { LogoMark } from "../components/Icons";

// Marco comun de las pantallas sin sesion: login, registro y contrasenas.
export function AccesoShell({ children, pie }: { children: ReactNode; pie?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <LogoMark className="mx-auto h-9 w-9 text-accent" />
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">Plataforma de control de obras</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Bitácora</h1>
        </div>
        <div className="space-y-4 rounded-lg border border-black/10 bg-white p-6 shadow-sm">{children}</div>
        {pie && <div className="mt-4 space-y-1 text-center text-sm text-ink-soft">{pie}</div>}
      </div>
    </div>
  );
}

export const enlace = "font-medium text-accent hover:underline";

// Envia el formulario mostrando "cargando" y el error del API.
function useEnvio(fn: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  return { error, loading, onSubmit };
}

export function Registro() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, loading, onSubmit } = useEnvio(async () => {
    await registrar(empresa, email, password);
    navigate("/", { replace: true });
  });

  return (
    <AccesoShell pie={<p>¿Ya tienes cuenta? <Link to="/" className={enlace}>Inicia sesión</Link></p>}>
      <form onSubmit={onSubmit} className="space-y-4">
        <h2 className="font-semibold text-ink">Crea la cuenta de tu empresa</h2>
        <div>
          <Label>Nombre de la empresa</Label>
          <Input autoFocus required minLength={2} value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
        </div>
        <div>
          <Label>Tu correo</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.mx" />
        </div>
        <div>
          <Label>Contraseña</Label>
          <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
        </div>
        {error && <p className="text-sm text-crit">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creando…" : "Crear cuenta"}
        </Button>
      </form>
    </AccesoShell>
  );
}

export function Olvide() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const { error, loading, onSubmit } = useEnvio(async () => {
    await api.post("/auth/olvide", { email });
    setEnviado(true);
  });

  return (
    <AccesoShell pie={<p><Link to="/" className={enlace}>Volver a iniciar sesión</Link></p>}>
      {enviado ? (
        <p className="text-sm text-ink">
          Si <strong>{email}</strong> tiene una cuenta, te enviamos un correo con un link para restablecer la contraseña. Vale 1 hora.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="font-semibold text-ink">Recupera tu contraseña</h2>
          <div>
            <Label>Correo</Label>
            <Input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="text-sm text-crit">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      )}
    </AccesoShell>
  );
}

// Sirve para recuperacion e invitacion: ambos correos traen ?token=.
export function Restablecer() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [listo, setListo] = useState(false);
  const { error, loading, onSubmit } = useEnvio(async () => {
    if (password !== confirmacion) throw new Error("Las contraseñas no coinciden");
    await api.post("/auth/restablecer", { token, password });
    setListo(true);
  });

  return (
    <AccesoShell pie={<p><Link to="/" className={enlace}>Ir a iniciar sesión</Link></p>}>
      {listo ? (
        <p className="text-sm text-ok">Listo, tu contraseña quedó guardada. Ya puedes iniciar sesión.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="font-semibold text-ink">Define tu contraseña</h2>
          <div>
            <Label>Nueva contraseña</Label>
            <Input type="password" autoFocus required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <Label>Confírmala</Label>
            <Input type="password" required minLength={8} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
          </div>
          {error && <p className="text-sm text-crit">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? "Guardando…" : "Guardar contraseña"}
          </Button>
          {!token && <p className="text-sm text-crit">Al link le falta el token; ábrelo desde el correo.</p>}
        </form>
      )}
    </AccesoShell>
  );
}
