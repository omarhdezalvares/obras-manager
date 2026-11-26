import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoCuenta, limitesDe } from "./plan";

const v = new Date("2026-12-01T00:00:00Z");
const DIA = 86_400_000;

test("piloto siempre activa y activo=false siempre suspendida", () => {
  assert.equal(estadoCuenta({ plan: "piloto", vigenteHasta: null, activo: true }), "activa");
  assert.equal(estadoCuenta({ plan: "piloto", vigenteHasta: null, activo: false }), "suspendida");
  assert.equal(estadoCuenta({ plan: "basico", vigenteHasta: v, activo: false }, v), "suspendida");
});

test("fronteras de vigencia y gracia", () => {
  assert.equal(estadoCuenta({ plan: "trial", vigenteHasta: v, activo: true }, v), "prueba");
  assert.equal(estadoCuenta({ plan: "basico", vigenteHasta: v, activo: true }, v), "activa");
  assert.equal(estadoCuenta({ plan: "basico", vigenteHasta: v, activo: true }, new Date(v.getTime() + 7 * DIA)), "gracia");
  assert.equal(estadoCuenta({ plan: "trial", vigenteHasta: v, activo: true }, new Date(v.getTime() + 7 * DIA)), "gracia");
  assert.equal(estadoCuenta({ plan: "basico", vigenteHasta: v, activo: true }, new Date(v.getTime() + 7 * DIA + 1)), "solo_lectura");
});

test("sin vigencia y plan de pago es solo lectura", () => {
  assert.equal(estadoCuenta({ plan: "basico", vigenteHasta: null, activo: true }), "solo_lectura");
});

test("limites por plan", () => {
  assert.deepEqual(limitesDe("profesional"), { obras: 10, usuarios: 30 });
  assert.equal(limitesDe("empresa").obras, Infinity);
  assert.equal(limitesDe("piloto").usuarios, Infinity);
  assert.deepEqual(limitesDe("trial"), { obras: 3, usuarios: 10 });
  assert.deepEqual(limitesDe("raro"), { obras: 3, usuarios: 10 });
});
