// Onboarding: registro de empresa con correo verificado, recuperar contrasena e invitacion por correo.
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
    return texto.match(/(?:restablecer|verificar)\?token=([a-f0-9]+)/)?.[1] ?? null;
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

test("registro: la empresa se crea hasta confirmar el correo", async () => {
  const datos = { empresa: "Constructora Pérez", email: "dueno@perez.mx", password: "Segura123!" };
  const token = await tokenEnviado(async () => assert.equal((await post("/api/auth/registro", datos)).status, 202));
  assert.ok(token);
  assert.equal((await post("/api/auth/login", { email: datos.email, password: datos.password })).status, 401, "sin confirmar no hay cuenta");

  const res = await post("/api/auth/verificar", { token });
  assert.equal(res.status, 201);
  assert.equal(res.data.usuario.rol, "Administrador");
  assert.equal(res.data.usuario.tenantNombre, "Constructora Pérez");
  assert.equal((await post("/api/auth/verificar", { token })).status, 400, "el link ya se uso");
  assert.equal((await post("/api/auth/verificar", { token: "falso" })).status, 400);

  const roles = await fetch(`${base}/api/usuarios/roles`, { headers: { authorization: `Bearer ${res.data.accessToken}` } });
  assert.equal(((await roles.json()) as unknown[]).length, 6);

  assert.equal((await post("/api/auth/login", { email: datos.email, password: datos.password })).status, 200);
  assert.equal((await post("/api/auth/registro", { ...datos, empresa: "Otra" })).status, 409);
});

test("contrasena segura: se rechazan las debiles", async () => {
  const { passwordSegura } = await import("../../lib/password");
  for (const password of ["Corta1!", "sinmayuscula1!", "SINMINUSCULA1!", "SinNumero!!", "SinSimbolo123"]) {
    assert.equal(passwordSegura.safeParse(password).success, false, password);
  }
  assert.equal(passwordSegura.safeParse("Segura123!").success, true);
  assert.equal((await post("/api/auth/registro", { empresa: "Otra", email: "otro@x.mx", password: "debil" })).status, 400);
});

test("recuperar contrasena: link de un solo uso", async () => {
  assert.equal(await tokenEnviado(() => post("/api/auth/olvide", { email: "nadie@x.mx" })), null, "correo inexistente no envia nada");

  const token = await tokenEnviado(async () => assert.equal((await post("/api/auth/olvide", { email: "dueno@perez.mx" })).status, 204));
  assert.ok(token);
  assert.equal((await post("/api/auth/restablecer", { token, password: "Nueva1234!" })).status, 204);
  assert.equal((await post("/api/auth/restablecer", { token, password: "Otra12345!" })).status, 400, "el link ya se uso");
  assert.equal((await post("/api/auth/restablecer", { token: "falso", password: "Otra12345!" })).status, 400);

  assert.equal((await post("/api/auth/login", { email: "dueno@perez.mx", password: "Segura123!" })).status, 401);
  assert.equal((await post("/api/auth/login", { email: "dueno@perez.mx", password: "Nueva1234!" })).status, 200);
});

test("invitacion: el usuario sin contrasena la define con el link", async () => {
  const admin = (await post("/api/auth/login", { email: "dueno@perez.mx", password: "Nueva1234!" })).data.accessToken;
  const roles = (await (await fetch(`${base}/api/usuarios/roles`, { headers: { authorization: `Bearer ${admin}` } })).json()) as { id: string; nombre: string }[];
  const oficial = roles.find((r) => r.nombre === "Oficial")!;

  const token = await tokenEnviado(async () => {
    assert.equal((await post("/api/usuarios", { email: "ivan@perez.mx", rolId: oficial.id }, admin)).status, 201);
  });
  assert.ok(token);
  assert.equal((await post("/api/auth/restablecer", { token, password: "Ivan12345!" })).status, 204);
  const login = await post("/api/auth/login", { email: "ivan@perez.mx", password: "Ivan12345!" });
  assert.equal(login.status, 200);
  assert.equal(login.data.usuario.rol, "Oficial");
});
