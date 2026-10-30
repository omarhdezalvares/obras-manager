import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { apiErrorMessage } from "../lib/api";
import { Button, Input, Label } from "../components/ui";
import { AccesoShell, enlace } from "./Acceso";

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccesoShell
      pie={
        <>
          <p>
            <Link to="/olvide" className={enlace}>¿Olvidaste tu contraseña?</Link>
          </p>
          <p>
            ¿Tu empresa aún no usa Bitácora? <Link to="/registro" className={enlace}>Crea una cuenta</Link>
          </p>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>Correo</Label>
          <Input
            type="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.test"
          />
        </div>
        <div>
          <Label>Contraseña</Label>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-sm text-crit">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AccesoShell>
  );
}
