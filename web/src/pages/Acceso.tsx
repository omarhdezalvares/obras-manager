import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

// Misma regla que passwordSegura del server; aqui solo guia al usuario mientras escribe.
const REGLAS_PASSWORD: [string, RegExp][] = [
  ["8 caracteres o más", /^.{8,}$/],
  ["Una mayúscula", /[A-Z]/],
  ["Una minúscula", /[a-z]/],
  ["Un número", /[0-9]/],
  ["Un símbolo", /[^A-Za-z0-9]/],
];

// Contrasena nueva + confirmacion; lanza el error a useEnvio si no cumple o no coincide.
function usePasswordNueva() {
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  function validar() {
    if (REGLAS_PASSWORD.some(([, re]) => !re.test(password))) throw new Error("La contraseña no cumple los requisitos");
    if (password !== confirmacion) throw new Error("Las contraseñas no coinciden");
  }
  const campos = (
    <>
      <div>
        <Label>Contraseña</Label>
        <Input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <ul className="mt-2 grid grid-cols-2 gap-x-2 text-xs">
          {REGLAS_PASSWORD.map(([texto, re]) => (
            <li key={texto} className={re.test(password) ? "text-ok" : "text-ink-soft"}>
              {re.test(password) ? "✓" : "·"} {texto}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Label>Confírmala</Label>
        <Input type="password" required autoComplete="new-password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
        {confirmacion && confirmacion !== password && <p className="mt-1 text-xs text-crit">No coincide</p>}
      </div>
    </>
  );
  return { password, validar, campos };
}

export function Registro() {
  const { registrar } = useAuth();
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const { password, validar, campos } = usePasswordNueva();
  const { error, loading, onSubmit } = useEnvio(async () => {
    validar();
    await registrar(empresa, email, password);
    setEnviado(true);
  });

  if (enviado) {
    return (
      <AccesoShell pie={<p><Link to="/" className={enlace}>Volver a iniciar sesión</Link></p>}>
        <h2 className="font-semibold text-ink">Revisa tu correo</h2>
        <p className="text-sm text-ink">
          Te enviamos un link a <strong>{email}</strong> para confirmar que es tuyo. Ábrelo para terminar de crear la cuenta; vale 24 horas.
        </p>
        <p className="text-xs text-ink-soft">¿No llega? Revisa spam o <button type="button" className={enlace} onClick={() => setEnviado(false)}>vuelve a intentarlo</button>.</p>
      </AccesoShell>
    );
  }

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
        {campos}
        {error && <p className="text-sm text-crit">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Enviando…" : "Crear cuenta"}
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
  const { password, validar, campos } = usePasswordNueva();
  const [listo, setListo] = useState(false);
  const { error, loading, onSubmit } = useEnvio(async () => {
    validar();
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
          {campos}
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

// Link del correo de registro: confirma el correo, crea la empresa y entra (App redirige al inicio).
export function Verificar() {
  const { verificar } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(token ? null : "Al link le falta el token; ábrelo desde el correo.");
  const enviado = useRef(false);

  useEffect(() => {
    // El link es de un solo uso: StrictMode monta dos veces y no debe gastarlo.
    if (!token || enviado.current) return;
    enviado.current = true;
    verificar(token).catch((err) => setError(apiErrorMessage(err)));
  }, [token, verificar]);

  return (
    <AccesoShell pie={<p><Link to="/registro" className={enlace}>Registrarme de nuevo</Link> · <Link to="/" className={enlace}>Iniciar sesión</Link></p>}>
      {error ? <p className="text-sm text-crit">{error}</p> : <p className="text-sm text-ink">Confirmando tu correo y creando tu cuenta…</p>}
    </AccesoShell>
  );
}
