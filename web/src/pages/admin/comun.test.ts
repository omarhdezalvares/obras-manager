import { test } from "node:test";
import assert from "node:assert/strict";
import { etiquetaHistorial } from "./comun";

test("historial: un pago de Stripe no se confunde con datos corregidos", () => {
  assert.equal(etiquetaHistorial({ accion: "actualizar", quien: "stripe" }), "Pago en Stripe");
  assert.equal(etiquetaHistorial({ accion: "actualizar", quien: "jefe@bitacora.mx" }), "Datos corregidos");
  assert.equal(etiquetaHistorial({ accion: "pago_manual", quien: "jefe@bitacora.mx" }), "Pago manual");
  assert.equal(etiquetaHistorial({ accion: "otra", quien: "x" }), "otra");
});
