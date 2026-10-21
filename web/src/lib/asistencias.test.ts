import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorDia, horasRegistradasEnFecha, seleccionInicial } from "./asistencias";

const lista = [
  { personaId: "a", fecha: "2026-10-21T06:00:00.000Z", horaLlegada: "08:10" },
  { personaId: "b", fecha: "2026-10-20T06:00:00.000Z", horaLlegada: "09:00" },
];

test("solo personas con asistencia en esa fecha", () => {
  const m = horasRegistradasEnFecha(lista, "2026-10-21");
  assert.equal(m.get("a"), "08:10");
  assert.equal(m.has("b"), false);
});
test("sin datos devuelve mapa vacio", () => assert.equal(horasRegistradasEnFecha(undefined, "2026-10-21").size, 0));

test("preselecciona solo si esta asignado", () => assert.deepEqual([...seleccionInicial("a", [{ personaId: "a" }])], ["a"]));
test("no preselecciona si no esta en la obra", () => assert.equal(seleccionInicial("a", [{ personaId: "b" }]).size, 0));
test("no preselecciona si la asignacion esta inactiva", () => assert.equal(seleccionInicial("a", [{ personaId: "a", activo: false }]).size, 0));
test("sin persona", () => assert.equal(seleccionInicial(null, [{ personaId: "b" }]).size, 0));

test("agrupa por dia, mas reciente primero, con costo", () => {
  const g = agruparPorDia([
    { fecha: "2026-10-19T06:00:00.000Z", transaccion: { monto: 550 } },
    { fecha: "2026-10-20T06:00:00.000Z", transaccion: { monto: 650 } },
    { fecha: "2026-10-20T06:00:00.000Z", transaccion: null },
  ]);
  assert.deepEqual(g.map((d) => [d.fecha, d.items.length, d.costo]), [["2026-10-20", 2, 650], ["2026-10-19", 1, 550]]);
});
