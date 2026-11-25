import { test } from "node:test";
import assert from "node:assert/strict";
import { whatsappUrl } from "./whatsapp";

test("sin numero no hay enlace", () => {
  assert.equal(whatsappUrl(undefined, "x"), null);
  assert.equal(whatsappUrl("", "x"), null);
  assert.equal(whatsappUrl("  ", "x"), null);
});

test("numero sin digitos suficientes no hay enlace", () => {
  assert.equal(whatsappUrl("abc", "x"), null);
  assert.equal(whatsappUrl("12345", "x"), null);
});

test("normaliza el numero y codifica el mensaje", () => {
  assert.equal(
    whatsappUrl("+52 33 1234-5678", "Hola, quiero conocer Bitácora para mi empresa."),
    "https://wa.me/523312345678?text=Hola%2C%20quiero%20conocer%20Bit%C3%A1cora%20para%20mi%20empresa.",
  );
});

test("sin lada de pais no hay enlace y el prefijo 00 se quita", () => {
  assert.equal(whatsappUrl("33 1234 5678", "x"), null);
  assert.equal(whatsappUrl("0052 33 1234 5678", "x"), "https://wa.me/523312345678?text=x");
});
