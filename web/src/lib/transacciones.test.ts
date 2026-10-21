import { test } from "node:test";
import assert from "node:assert/strict";
import { fechaTransaccion, grupoDeTipo } from "./transacciones";

test("fecha de la asistencia", () =>
  assert.equal(fechaTransaccion({ createdAt: "2026-10-22T01:00:00Z", asistencia: { fecha: "2026-10-20T06:00:00Z" } }), "2026-10-20"));
test("fecha de la remision", () =>
  assert.equal(fechaTransaccion({ createdAt: "2026-10-22T01:00:00Z", remision: { fecha: "2026-10-19T00:00:00Z" } }), "2026-10-19"));
test("sin vinculo usa el dia local de createdAt", () =>
  assert.equal(fechaTransaccion({ createdAt: new Date(2026, 9, 21, 23, 0).toISOString() }), "2026-10-21"));
test("grupos", () => {
  assert.equal(grupoDeTipo("costo_mano_obra"), "mano_obra");
  assert.equal(grupoDeTipo("costo_material"), "material");
  assert.equal(grupoDeTipo("bono"), "bonos");
  assert.equal(grupoDeTipo("comision"), "bonos");
  assert.equal(grupoDeTipo("ajuste_presupuesto"), "presupuesto");
  assert.equal(grupoDeTipo("presupuesto_inicial"), "presupuesto");
  assert.equal(grupoDeTipo("devolucion"), "otros");
  assert.equal(grupoDeTipo("otro_costo"), "otros");
});
