import { test } from "node:test";
import assert from "node:assert/strict";
import { etiquetaEstadoHerramienta, etiquetaEstadoObra, etiquetaTipoPartida } from "./etiquetas";

test("estado obra", () => assert.equal(etiquetaEstadoObra("en_ejecucion"), "En ejecución"));
test("tipo partida", () => assert.equal(etiquetaTipoPartida("mano_obra"), "Mano de obra"));
test("tipo partida nulo", () => assert.equal(etiquetaTipoPartida(null), "Otro"));
test("estado herramienta", () => assert.equal(etiquetaEstadoHerramienta("mantenimiento"), "Mantenimiento"));
test("desconocido legible", () => assert.equal(etiquetaEstadoObra("en_revision"), "En revision"));
