import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../lib/api";
import { EmpresaPerfil } from "../lib/types";
import { useAuth } from "../lib/auth";
import { Button, Card, Input, Label, Pill } from "../components/ui";
import { IconEmpresa } from "../components/Icons";

export function Empresa() {
  const { usuario, refreshUsuario } = useAuth();
  const puedeEditar = usuario?.rol === "Administrador";
  const [editando, setEditando] = useState(false);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["empresa"],
    queryFn: () => api.get<EmpresaPerfil>("/empresa").then((r) => r.data),
  });

  const empresa = query.data;

  const [nombre, setNombre] = useState("");
  const [rfc, setRfc] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correoContacto, setCorreoContacto] = useState("");
  const [colorPrimario, setColorPrimario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logoMsg, setLogoMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  // El formulario se carga solo al entrar a editar: si se recargara con cada
  // refetch (p. ej. tras subir el logo) se perderian los cambios sin guardar.
  function iniciarEdicion() {
    if (!empresa) return;
    setNombre(empresa.nombre);
    setRfc(empresa.rfc ?? "");
    setDireccion(empresa.direccion ?? "");
    setTelefono(empresa.telefono ?? "");
    setCorreoContacto(empresa.correoContacto ?? "");
    setColorPrimario(empresa.colorPrimario ?? "");
    setError(null);
    setLogoMsg(null);
    setEditando(true);
  }

  const mutation = useMutation({
    mutationFn: () => api.patch("/empresa", { nombre, rfc, direccion, telefono, correoContacto, colorPrimario }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["empresa"] });
      await refreshUsuario();
      setEditando(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const subirLogo = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("logo", file);
      return api.post("/empresa/logo", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onMutate: () => setLogoMsg(null),
    onSuccess: () => {
      setLogoMsg({ ok: true, texto: "Logo actualizado. Ya aparece en el PDF de evidencias." });
      qc.invalidateQueries({ queryKey: ["empresa"] });
    },
    onError: (err) => setLogoMsg({ ok: false, texto: apiErrorMessage(err) }),
  });

  if (!empresa) return <p className="text-sm text-ink-soft">Cargando…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconEmpresa className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-2xl font-bold text-ink">Empresa</h1>
            <p className="text-sm text-ink-soft">Perfil de la compañía registrada en Bitácora.</p>
          </div>
        </div>
        {puedeEditar && !editando && <Button onClick={iniciarEdicion}>Editar</Button>}
      </div>

      {!editando && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            {empresa.logoUrl && <img src={empresa.logoUrl} alt="Logo" className="h-10 w-10 rounded object-contain" />}
            <p className="text-lg font-semibold text-ink">{empresa.nombre}</p>
            <Pill tone="neutral">Plan {empresa.plan}</Pill>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">RFC</dt>
              <dd className="text-ink">{empresa.rfc ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Teléfono</dt>
              <dd className="text-ink">{empresa.telefono ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Correo de contacto</dt>
              <dd className="text-ink">{empresa.correoContacto ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Dirección</dt>
              <dd className="text-ink">{empresa.direccion ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Color de reportes</dt>
              <dd className="flex items-center gap-2 text-ink">
                {empresa.colorPrimario ? (
                  <>
                    <span className="h-4 w-4 rounded border border-black/10" style={{ background: empresa.colorPrimario }} />
                    {empresa.colorPrimario}
                  </>
                ) : (
                  "Predeterminado"
                )}
              </dd>
            </div>
          </dl>
          {!puedeEditar && (
            <p className="text-xs text-ink-soft">Solo un Administrador puede modificar esta información.</p>
          )}
        </Card>
      )}

      {editando && (
        <Card>
          <h2 className="mb-2 font-semibold text-ink">Editar perfil de empresa</h2>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setError(null);
              mutation.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <Label>Razón social</Label>
              <Input required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>RFC</Label>
                <Input value={rfc} onChange={(e) => setRfc(e.target.value)} placeholder="XAXX010101000" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Correo de contacto</Label>
              <Input type="email" value={correoContacto} onChange={(e) => setCorreoContacto(e.target.value)} />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>Color de reportes</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Color de reportes"
                    className="h-10 w-14 cursor-pointer rounded border border-black/10"
                    value={colorPrimario || "#5C4632"}
                    onChange={(e) => setColorPrimario(e.target.value)}
                  />
                  {colorPrimario && (
                    <Button type="button" variant="ghost" onClick={() => setColorPrimario("")}>
                      Usar predeterminado
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label>Logo (PNG o JPG)</Label>
                <div className="flex items-center gap-2">
                  {empresa.logoUrl && <img src={empresa.logoUrl} alt="Logo actual" className="h-16 w-16 rounded border border-black/10 object-contain" />}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    disabled={subirLogo.isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) subirLogo.mutate(file);
                      e.target.value = "";
                    }}
                    className="text-sm"
                  />
                </div>
                {subirLogo.isPending && <p className="text-xs text-ink-soft">Subiendo logo…</p>}
                {logoMsg && <p className={`text-xs ${logoMsg.ok ? "text-ok" : "text-crit"}`}>{logoMsg.texto}</p>}
              </div>
            </div>
            <p className="text-xs text-ink-soft">El color y el logo se usan en el encabezado del PDF de evidencias y en los reportes de Excel.</p>
            {error && <p className="text-sm text-crit">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
