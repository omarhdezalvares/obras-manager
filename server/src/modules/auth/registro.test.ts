// Onboarding: registro de empresa, recuperar contrasena e invitacion por correo.
// Sin RESEND_API_KEY los correos se imprimen en consola; de ahi se lee el link.
import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { usarSchemaDeTest } from "../../testDb";

usarSchemaDeTest("test_registro");
delete process.env.RESEND_API_KEY;

let server: Server;
let base = "";

async function post(ruta: string, body: unknown, token?: string) {
  const res = await fetch(base + ruta, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: res.status === 204 ? null : await res.json() };
}

// Ejecuta `fn` y devuelve el token del link que se "envio" por correo (o null).
async function tokenEnviado(fn: () => Promise<unknown>): Promise<string | null> {
  const log = mock.method(console, "log", () => {});
  try {
    await fn();
    const texto = log.mock.calls.map((c) => String(c.arguments[0])).join("\n");
    return texto.match(/restablecer\?token=([a-f0-9]+)/)?.[1] ?? null;
  } finally {
    log.mock.restore();
  }
}

before(async () => {
  execSync("npx prisma db push --force-reset --skip-generate", { cwd: path.resolve(__dirname, "../../.."), env: process.env, stdio: "ignore" });
  const { app } = await import("../../app");
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  const { prisma } = await import("../../lib/prisma");
  await prisma.$disconnect();
});

test("registro crea la empresa con sus roles y entra como Administrador", async () => {
  const res = await post("/api/auth/registro", { empresa: "Constructora Pérez", email: "dueno@perez.mx", password: "segura123" });
  assert.equal(res.status, 201);
  assert.equal(res.data.usuario.rol, "Administrador");
  assert.equal(res.data.usuario.tenantNombre, "Constructora Pérez");

  const roles = await fetch(`${base}/api/usuarios/roles`, { headers: { authorization: `Bearer ${res.data.accessToken}` } });
  assert.equal(((await roles.json()) as unknown[]).length, 6);

  assert.equal((await post("/api/auth/login", { email: "dueno@perez.mx", password: "segura123" })).status, 200);
  assert.equal((await post("/api/auth/registro", { empresa: "Otra", email: "dueno@perez.mx", password: "segura123" })).status, 409);
  assert.equal((await post("/api/auth/registro", { empresa: "Otra", email: "otro@x.mx", password: "corta" })).status, 400);
});

test("recuperar contrasena: link de un solo uso", async () => {
  assert.equal(await tokenEnviado(() => post("/api/auth/olvide", { email: "nadie@x.mx" })), null, "correo inexistente no envia nada");

  const token = await tokenEnviado(async () => assert.equal((await post("/api/auth/olvide", { email: "dueno@perez.mx" })).status, 204));
  assert.ok(token);
  assert.equal((await post("/api/auth/restablecer", { token, password: "nueva1234" })).status, 204);
  assert.equal((await post("/api/auth/restablecer", { token, password: "otra12345" })).status, 400, "el link ya se uso");
  assert.equal((await post("/api/auth/restablecer", { token: "falso", password: "otra12345" })).status, 400);

  assert.equal((await post("/api/auth/login", { email: "dueno@perez.mx", password: "segura123" })).status, 401);
  assert.equal((await post("/api/auth/login", { email: "dueno@perez.mx", password: "nueva1234" })).status, 200);
});

test("invitacion: el usuario sin contrasena la define con el link", async () => {
  const admin = (await post("/api/auth/login", { email: "dueno@perez.mx", password: "nueva1234" })).data.accessToken;
  const roles = (await (await fetch(`${base}/api/usuarios/roles`, { headers: { authorization: `Bearer ${admin}` } })).json()) as { id: string; nombre: string }[];
  const oficial = roles.find((r) => r.nombre === "Oficial")!;

  const token = await tokenEnviado(async () => {
    assert.equal((await post("/api/usuarios", { email: "ivan@perez.mx", rolId: oficial.id }, admin)).status, 201);
  });
  assert.ok(token);
  assert.equal((await post("/api/auth/restablecer", { token, password: "ivan12345" })).status, 204);
  const login = await post("/api/auth/login", { email: "ivan@perez.mx", password: "ivan12345" });
  assert.equal(login.status, 200);
  assert.equal(login.data.usuario.rol, "Oficial");
});
