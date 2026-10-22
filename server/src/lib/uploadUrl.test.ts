import { test } from "node:test";
import assert from "node:assert/strict";
import { firmaValida, urlFirmada } from "./uploadUrl";

function partes(url: string) {
  const u = new URL(url, "http://x");
  return { key: u.pathname.slice("/uploads/".length), exp: u.searchParams.get("exp")!, sig: u.searchParams.get("sig")! };
}

test("link firmado: valido para su archivo, invalido para otro, expirado o alterado", () => {
  const ahora = Date.UTC(2026, 9, 22, 10);
  const { key, exp, sig } = partes(urlFirmada("abc.jpg", ahora));
  assert.equal(key, "abc.jpg");
  assert.equal(firmaValida(key, exp, sig, ahora), true);
  assert.equal(firmaValida(key, exp, sig, ahora + 6 * 60 * 60 * 1000), true); // dura al menos 6h
  assert.equal(firmaValida(key, exp, sig, ahora + 13 * 60 * 60 * 1000), false);
  assert.equal(firmaValida("otro.jpg", exp, sig, ahora), false);
  assert.equal(firmaValida(key, String(Number(exp) + 1), sig, ahora), false);
  assert.equal(firmaValida(key, exp, "x", ahora), false);
});
