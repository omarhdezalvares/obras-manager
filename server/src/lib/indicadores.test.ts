import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularIndicadores, DatosIndicadores } from "./indicadores";

const base = (): DatosIndicadores => ({
  obras: [
    { id: "tn", nombre: "Torre Norte", presupuesto: 257000, consumido: 17333, fechaInicio: "2026-10-01", fechaFinEstimada: "2026-10-31" },
    { id: "p2", nombre: "Planta 2", presupuesto: 0, consumido: 700, fechaInicio: "2026-10-01", fechaFinEstimada: null },
  ],
  asistencias: [
    { obraId: "tn", personaId: "rosa", fecha: "2026-10-17", horaLlegada: "07:45" },
    { obraId: "tn", personaId: "ivan", fecha: "2026-10-17", horaLlegada: "07:45" },
    { obraId: "tn", personaId: "marco", fecha: "2026-10-17", horaLlegada: "08:15" },
    { obraId: "tn", personaId: "rosa", fecha: "2026-10-18", horaLlegada: "07:45" },
    { obraId: "p2", personaId: "ivan", fecha: "2026-10-20", horaLlegada: "08:00" },
  ],
  avances: [
    { obraId: "tn", fecha: "2026-10-17", fotos: 0 },
    { obraId: "tn", fecha: "2026-10-18", fotos: 2 },
  ],
  transacciones: [
    { obraId: "tn", fecha: "2026-10-17", tipo: "costo_mano_obra", monto: 1780 },
    { obraId: "tn", fecha: "2026-10-19", tipo: "costo_material", monto: 5212.5 },
    { obraId: "tn", fecha: "2026-10-19", tipo: "comision", monto: 500 },
    { obraId: "tn", fecha: "2026-10-19", tipo: "presupuesto_inicial", monto: 90000 },
  ],
  obraPersonas: [
    { obraId: "tn", personaId: "rosa", nombre: "Rosa Beltrán" },
    { obraId: "tn", personaId: "ivan", nombre: "Iván Salgado" },
    { obraId: "p2", personaId: "ivan", nombre: "Iván Salgado" },
  ],
  personasActivas: [{ id: "rosa" }, { id: "ivan" }, { id: "karla" }],
  herramientas: [{ estado: "asignada" }, { estado: "asignada" }, { estado: "disponible" }],
  asignaciones: [{ obraId: "tn", nombre: "Multímetro" }, { obraId: "tn", nombre: "Ponchadora" }],
});

const opts = { desde: "2026-10-17", hasta: "2026-10-20", hoy: "2026-10-20", verFinanciero: true };

test("dias es el rango inclusivo", () => {
  assert.deepEqual(calcularIndicadores(base(), opts).dias, ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"]);
});

test("personalPorDia cuenta personas distintas por obra y dia", () => {
  const r = calcularIndicadores(base(), opts);
  assert.deepEqual(r.personalPorDia.find((f) => f.obraId === "tn")!.valores, [3, 1, 0, 0]);
  assert.deepEqual(r.personalPorDia.find((f) => f.obraId === "p2")!.valores, [0, 0, 0, 1]);
});

test("kpis de personal, llegada y herramientas", () => {
  const k = calcularIndicadores(base(), opts).kpis;
  assert.equal(k.diasHombre, 5);
  assert.deepEqual(k.personalHoy, { llegaron: 1, asignados: 2 });
  assert.equal(k.llegadaPromedio, "07:54");
  assert.deepEqual(k.herramientasEnUso, { asignadas: 2, total: 3 });
  assert.equal(k.costoDiaHombre, 356);
});

test("cumplimiento: dia con asistencia y evidencia con al menos una foto", () => {
  const r = calcularIndicadores(base(), opts);
  assert.deepEqual(r.cumplimiento.find((c) => c.obraId === "tn"), { obraId: "tn", nombre: "Torre Norte", con: 1, total: 2 });
  assert.deepEqual(r.kpis.bitacoraAlDia, { con: 1, total: 3 });
});

test("gasto diario separa mano de obra, material y otros; ignora presupuesto", () => {
  const g = calcularIndicadores(base(), opts).gastoDiario!;
  assert.deepEqual(g[0], { fecha: "2026-10-17", manoObra: 1780, material: 0, otros: 0 });
  assert.deepEqual(g[2], { fecha: "2026-10-19", manoObra: 0, material: 5212.5, otros: 500 });
});

test("obras por persona, sin obra, herramientas por obra e inventario", () => {
  const r = calcularIndicadores(base(), opts);
  assert.deepEqual(r.obrasPorPersona.find((p) => p.nombre === "Iván Salgado")!.obras, ["Torre Norte", "Planta 2"]);
  assert.equal(r.personasSinObra, 1);
  assert.deepEqual(r.herramientasPorObra.find((h) => h.obraId === "tn")!.herramientas, ["Multímetro", "Ponchadora"]);
  assert.deepEqual(r.herramientasPorObra.find((h) => h.obraId === "p2")!.herramientas, []);
  assert.deepEqual(r.inventario, { asignada: 2, disponible: 1 });
});

test("dias-hombre por obra con costo de mano de obra", () => {
  const r = calcularIndicadores(base(), opts);
  assert.deepEqual(r.diasHombre.find((d) => d.obraId === "tn"), { obraId: "tn", nombre: "Torre Norte", dias: 4, costo: 1780 });
});

test("sin acceso financiero no hay montos ni porcentajes de gasto", () => {
  const r = calcularIndicadores(base(), { ...opts, verFinanciero: false });
  assert.equal(r.gastoDiario, undefined);
  assert.equal(r.kpis.costoDiaHombre, undefined);
  assert.equal(r.plazoGasto, undefined);
  assert.ok(r.diasHombre.every((d) => d.costo === undefined));
});

test("plazo contra gasto omite obras sin fecha fin y acota el tiempo a 0-100", () => {
  const r = calcularIndicadores(base(), { ...opts, hoy: "2026-12-01" });
  assert.deepEqual(r.plazoGasto!.map((p) => p.obraId), ["tn"]);
  assert.equal(r.plazoGasto![0].pctTiempo, 100);
  assert.equal(r.plazoGasto![0].pctGasto, 7);
});

test("periodo sin datos: ceros y llegada promedio nula", () => {
  const r = calcularIndicadores(base(), { ...opts, desde: "2026-11-01", hasta: "2026-11-02", hoy: "2026-11-02" });
  assert.equal(r.kpis.diasHombre, 0);
  assert.equal(r.kpis.llegadaPromedio, null);
  assert.equal(r.kpis.costoDiaHombre, 0);
  assert.ok(r.personalPorDia.every((f) => f.valores.every((v) => v === 0)));
});

test("sin lista de personas activas no se informa 'sin obra'", () => {
  const d = base();
  delete d.personasActivas;
  assert.equal(calcularIndicadores(d, opts).personasSinObra, undefined);
});
