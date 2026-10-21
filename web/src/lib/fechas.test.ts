import { test } from "node:test";
import assert from "node:assert/strict";
import { fechaCorta, fechaLarga, horaLocal, hoyLocal } from "./fechas";

test("hoyLocal a las 23:30 locales sigue siendo el mismo dia", () =>
  assert.equal(hoyLocal(new Date(2026, 9, 21, 23, 30)), "2026-10-21"));
test("hoyLocal rellena con ceros", () => assert.equal(hoyLocal(new Date(2026, 0, 5, 8)), "2026-01-05"));
test("fechaCorta", () => assert.equal(fechaCorta("2026-10-20"), "mar 20 oct"));
test("fechaCorta ignora la hora del ISO", () => assert.equal(fechaCorta("2026-10-20T06:00:00.000Z"), "mar 20 oct"));
test("fechaLarga", () => assert.equal(fechaLarga("2026-10-20"), "martes 20 de octubre"));
test("horaLocal", () => assert.equal(horaLocal(new Date(2026, 9, 21, 7, 5)), "07:05"));
