import { test } from "node:test";
import assert from "node:assert/strict";
import { montoConSigno } from "./finance";

test("gastos siempre negativos", () => assert.equal(montoConSigno("costo_mano_obra", 566.66), -566.66));
test("ajuste negativo se conserva negativo", () => assert.equal(montoConSigno("ajuste_presupuesto", -49314.3), -49314.3));
test("ajuste positivo positivo", () => assert.equal(montoConSigno("ajuste_presupuesto", 1000), 1000));
test("presupuesto inicial positivo", () => assert.equal(montoConSigno("presupuesto_inicial", 50000), 50000));
