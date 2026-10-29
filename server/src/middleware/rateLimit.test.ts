import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";

process.env.DATABASE_URL = `file:${path.resolve(__dirname, "../../prisma/ratelimit-test.db")}`;

let consumirIntento: typeof import("./rateLimit").consumirIntento;
let server: Server;
let base = "";

before(async () => {
  execSync("npx prisma db push --force-reset --skip-generate", { cwd: path.resolve(__dirname, "../.."), env: process.env, stdio: "ignore" });
  ({ consumirIntento } = await import("./rateLimit"));
  const { app } = await import("../app");
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  const { prisma } = await import("../lib/prisma");
  await prisma.$disconnect();
});

test("permite max intentos por ventana y se reinicia al vencer", async () => {
  const t0 = new Date(Date.UTC(2026, 9, 28, 10));
  for (let i = 0; i < 3; i++) assert.equal(await consumirIntento("x", 3, 60_000, t0), null);
  assert.equal(await consumirIntento("x", 3, 60_000, new Date(t0.getTime() + 10_000)), 50); // faltan 50 s
  assert.equal(await consumirIntento("otra", 3, 60_000, t0), null, "cada clave cuenta aparte");
  assert.equal(await consumirIntento("x", 3, 60_000, new Date(t0.getTime() + 60_000)), null, "ventana vencida");
});

test("login responde 429 al intento 11 del mismo correo", async () => {
  const intento = () =>
    fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nadie@x.mx", password: "mal" }),
    });
  for (let i = 0; i < 10; i++) assert.equal((await intento()).status, 401);
  const res = await intento();
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get("retry-after")) > 0);
});
