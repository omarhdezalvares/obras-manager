import { test } from "node:test";
import assert from "node:assert/strict";
import { alertaPartida, esGasto, montoConSigno } from "./finance";

test("gastos siempre negativos", () => assert.equal(montoConSigno("costo_mano_obra", 566.66), -566.66));
test("ajuste negativo se conserva negativo", () => assert.equal(montoConSigno("ajuste_presupuesto", -49314.3), -49314.3));
test("ajuste positivo positivo", () => assert.equal(montoConSigno("ajuste_presupuesto", 1000), 1000));
test("presupuesto inicial positivo", () => assert.equal(montoConSigno("presupuesto_inicial", 50000), 50000));

test("bono y comision son gasto", () => {
  assert.equal(esGasto("bono"), true);
  assert.equal(esGasto("comision"), true);
  assert.equal(montoConSigno("bono", 1500), -1500);
});

const p = (nombre: string, porcentajeConsumido: number, presupuesto = 100) => ({
  id: nombre, codigo: nombre, nombre, tipo: null, estado: "activa", presupuestoInicial: presupuesto,
  presupuestoActualizado: presupuesto, consumido: 0, disponible: 0, porcentajeConsumido,
});
test("alerta con la partida mas consumida >= 90", () =>
  assert.deepEqual(alertaPartida([p("GEN", 0), p("MAT", 104.3), p("MO", 92)]), { partidaId: "MAT", nombre: "MAT", porcentaje: 104 }));
test("sin alerta bajo 90", () => assert.equal(alertaPartida([p("GEN", 89.9)]), null));
test("ignora partidas con presupuesto 0", () => assert.equal(alertaPartida([p("X", 0, 0)]), null));
test("sin partidas", () => assert.equal(alertaPartida([]), null));
