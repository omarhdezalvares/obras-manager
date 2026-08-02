import { FormEvent, useState } from "react";
import { useAuth } from "../lib/auth";
import { apiErrorMessage } from "../lib/api";
import { Button, Input, Label } from "../components/ui";
import { LogoMark } from "../components/Icons";

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
    <div className="flex min-h-screen items-center justify-center bg-[#F1EEE7] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <LogoMark className="mx-auto h-9 w-9 text-accent" />
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">Plataforma de control de obras</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Bitácora</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-black/10 bg-white p-6 shadow-sm">
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
      </div>
    </div>
  );
}
