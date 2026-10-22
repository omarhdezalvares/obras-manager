import { test } from "node:test";
import assert from "node:assert/strict";
import { folioReporte, resumenPeriodo } from "./avancesPdf";

test("folio: RE + fecha de emision local + 4 primeros caracteres de la obra", () => {
  assert.equal(folioReporte("26be431c-7a53-450f", new Date(2026, 9, 22, 23, 30)), "RE-20261022-26BE");
});

test("resumen: dias con registro, dias-hombre, fotos (solo imagenes) y personas distintas", () => {
  const r = resumenPeriodo(
    [
      { fecha: new Date(2026, 9, 17), fotos: [] },
      { fecha: new Date(2026, 9, 18), fotos: [{ tipoMime: "image/jpeg" }, { tipoMime: "image/png" }, { tipoMime: "application/pdf" }] },
      { fecha: new Date(2026, 9, 18), fotos: [{ tipoMime: "image/jpeg" }] },
    ],
    [{ personaId: "a" }, { personaId: "b" }, { personaId: "a" }]
  );
  assert.deepEqual(r, { dias: 2, diasHombre: 3, fotos: 3, personas: 2 });
});

test("resumen vacio", () => {
  assert.deepEqual(resumenPeriodo([], []), { dias: 0, diasHombre: 0, fotos: 0, personas: 0 });
});
