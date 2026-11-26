import { test } from "node:test";
import assert from "node:assert/strict";
import { resumenTablero, tendencias } from "./resumen";

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

test("tendencias: registros, compras y conversion por giro y canal; Sin dato al final si tiene menos", () => {
  const pago = new Date("2026-11-01T00:00:00Z");
  const r = tendencias([
    { giro: "Plomería", canal: "Google", plan: "profesional", primerPagoAt: pago },
    { giro: "Plomería", canal: "Google", plan: "trial", primerPagoAt: null },
    { giro: "Plomería", canal: "Recomendación", plan: "trial", primerPagoAt: null },
    { giro: null, canal: null, plan: "trial", primerPagoAt: null },
  ]);
  assert.deepEqual(r.porGiro, [
    { clave: "Plomería", registros: 3, compraron: 1, conversion: 33 },
    { clave: "Sin dato", registros: 1, compraron: 0, conversion: 0 },
  ]);
  assert.deepEqual(r.porCanal, [
    { clave: "Google", registros: 2, compraron: 1, conversion: 50 },
    { clave: "Recomendación", registros: 1, compraron: 0, conversion: 0 },
    { clave: "Sin dato", registros: 1, compraron: 0, conversion: 0 },
  ]);
  assert.deepEqual(r.planes, { basico: 0, profesional: 1, empresa: 0 });
});
