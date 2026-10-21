import { test } from "node:test";
import assert from "node:assert/strict";
import { horasRegistradasEnFecha } from "./asistencias";

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
