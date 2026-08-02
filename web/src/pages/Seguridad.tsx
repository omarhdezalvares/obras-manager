import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { Persona, RolOption, UsuarioAdmin } from "../lib/types";
import { useAuth } from "../lib/auth";
import { Button, Card, EmptyState, Input, Label, Pill, Select } from "../components/ui";
import { IconSeguridad } from "../components/Icons";

export function Seguridad() {
  const { usuario: yo } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);
  const [cambiandoPassword, setCambiandoPassword] = useState<UsuarioAdmin | null>(null);
  const qc = useQueryClient();

  const usuarios = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => api.get<UsuarioAdmin[]>("/usuarios").then((r) => r.data),
  });
  const roles = useQuery({
    queryKey: ["usuario-roles"],
    queryFn: () => api.get<RolOption[]>("/usuarios/roles").then((r) => r.data),
  });
  const personas = useQuery({
    queryKey: ["personas"],
    queryFn: () => api.get<Persona[]>("/personas").then((r) => r.data),
  });

  const toggleActivo = useMutation({
    mutationFn: (u: UsuarioAdmin) => api.patch(`/usuarios/${u.id}`, { activo: !u.activo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconSeguridad className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-xl font-semibold text-ink">Seguridad</h1>
            <p className="text-sm text-ink-soft">Usuarios con acceso a Bitácora: alta, edición, activación y contraseña.</p>
          </div>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "+ Nuevo usuario"}</Button>
      </div>

      {showForm && (
        <UsuarioForm roles={roles.data ?? []} personas={personas.data ?? []} onDone={() => setShowForm(false)} />
      )}
      {editando && (
        <UsuarioForm
          usuario={editando}
          roles={roles.data ?? []}
          personas={personas.data ?? []}
          onDone={() => setEditando(null)}
        />
      )}
      {cambiandoPassword && (
        <PasswordForm usuario={cambiandoPassword} onDone={() => setCambiandoPassword(null)} />
      )}

      {usuarios.data?.length === 0 && <EmptyState>Aún no hay usuarios registrados.</EmptyState>}

      <div className="space-y-2">
        {usuarios.data?.map((u) => (
          <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-ink">{u.email}</p>
                <Pill tone={u.activo ? "ok" : "crit"}>{u.activo ? "Activo" : "Inactivo"}</Pill>
              </div>
              <p className="text-xs text-ink-soft">
                {u.rolNombre} {u.personaNombre ? `· ${u.personaNombre}` : ""}
              </p>
              <p className="text-xs text-ink-soft">
                Último acceso: {u.ultimoLoginAt ? new Date(u.ultimoLoginAt).toLocaleString("es-MX") : "nunca"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setEditando(u)}>
                Editar
              </Button>
              <Button variant="ghost" onClick={() => setCambiandoPassword(u)}>
                Cambiar contraseña
              </Button>
              <Button
                variant={u.activo ? "danger" : "secondary"}
                disabled={u.id === yo?.id || toggleActivo.isPending}
                onClick={() => toggleActivo.mutate(u)}
              >
                {u.activo ? "Desactivar" : "Activar"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function UsuarioForm({
  usuario,
  roles,
  personas,
  onDone,
}: {
  usuario?: UsuarioAdmin;
  roles: RolOption[];
  personas: Persona[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState(usuario?.rolId ?? "");
  const [personaId, setPersonaId] = useState(usuario?.personaId ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (usuario) {
        return api.patch(`/usuarios/${usuario.id}`, {
          email,
          rolId: rolId || undefined,
          personaId: personaId || null,
        });
      }
      return api.post("/usuarios", {
        email,
        password,
        rolId,
        personaId: personaId || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Card>
      <h2 className="mb-2 font-semibold text-ink">{usuario ? "Editar usuario" : "Nuevo usuario"}</h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Correo</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {!usuario && (
            <div>
              <Label>Contraseña</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Rol</Label>
            <Select required value={rolId} onChange={(e) => setRolId(e.target.value)}>
              <option value="" disabled>
                Selecciona un rol
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Persona vinculada (opcional)</Label>
            <Select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
              <option value="">Sin vincular</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombreCompleto}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {error && <p className="text-sm text-crit">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : usuario ? "Guardar cambios" : "Crear usuario"}
          </Button>
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm({ usuario, onDone }: { usuario: UsuarioAdmin; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post(`/usuarios/${usuario.id}/password`, { password }),
    onSuccess: () => setListo(true),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (listo) {
    return (
      <Card>
        <p className="text-sm text-ok">Contraseña actualizada para {usuario.email}. Sus sesiones activas se cerraron.</p>
        <Button className="mt-3" variant="secondary" onClick={onDone}>
          Cerrar
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-2 font-semibold text-ink">Cambiar contraseña · {usuario.email}</h2>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <Label>Nueva contraseña</Label>
          <Input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        {error && <p className="text-sm text-crit">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : "Actualizar contraseña"}
          </Button>
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
