import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeCuenta } from "./cuenta";

const hoy = new Date("2026-12-01T12:00:00Z");
const en = (dias: number) => new Date(hoy.getTime() + dias * 86_400_000).toISOString();

test("prueba: avisa desde 5 dias antes", () => {
  assert.equal(mensajeCuenta({ estado: "prueba", vigenteHasta: en(6), finGracia: null }, hoy), null);
  assert.equal(mensajeCuenta({ estado: "prueba", vigenteHasta: en(5), finGracia: null }, hoy), "Te quedan 5 días de prueba.");
  assert.equal(mensajeCuenta({ estado: "prueba", vigenteHasta: en(4.2), finGracia: null }, hoy), "Te quedan 5 días de prueba.");
  assert.equal(mensajeCuenta({ estado: "prueba", vigenteHasta: en(0.5), finGracia: null }, hoy), "Te queda 1 día de prueba.");
});

test("gracia dice cuando pasa a solo lectura", () => {
  assert.equal(
    mensajeCuenta({ estado: "gracia", vigenteHasta: en(-2), finGracia: "2026-12-08T12:00:00Z" }, hoy),
    "Tu pago está pendiente. El 08/12 tu cuenta pasa a solo lectura."
  );
});

test("solo lectura y activa", () => {
  assert.equal(
    mensajeCuenta({ estado: "solo_lectura", vigenteHasta: en(-10), finGracia: en(-3) }, hoy),
    "Tu cuenta está en solo lectura. Contrata un plan para seguir capturando."
  );
  assert.equal(mensajeCuenta({ estado: "activa", vigenteHasta: en(20), finGracia: en(27) }, hoy), null);
});
