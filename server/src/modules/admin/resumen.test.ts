import { test } from "node:test";
import assert from "node:assert/strict";
import { resumenTablero } from "./resumen";

const ahora = new Date("2026-12-01T00:00:00Z");
const dias = (n: number) => new Date(ahora.getTime() + n * 86_400_000);

test("resumenTablero cuenta estados y suma el ingreso estimado de activas y en gracia", () => {
  const r = resumenTablero(
    [
      { plan: "profesional", activo: true, vigenteHasta: dias(10) },
      { plan: "basico", activo: true, vigenteHasta: dias(-3) },
      { plan: "trial", activo: true, vigenteHasta: dias(5) },
      { plan: "basico", activo: true, vigenteHasta: dias(-10) },
      { plan: "empresa", activo: false, vigenteHasta: dias(10) },
      { plan: "piloto", activo: true, vigenteHasta: null },
    ],
    ahora
  );
  assert.deepEqual(r.contadores, { pagando: 1, prueba: 1, gracia: 1, solo_lectura: 1, suspendida: 1, piloto: 1 });
  assert.equal(r.ingresoMensualEstimado, 2690 + 1290);
});
