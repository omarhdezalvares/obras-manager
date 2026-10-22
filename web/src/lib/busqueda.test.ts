import { test } from "node:test";
import assert from "node:assert/strict";
import { coincideBusqueda, materialPorNombre } from "./busqueda";

test("busqueda vacia coincide con todo", () => assert.equal(coincideBusqueda("  ", ["x"]), true));
test("ignora mayusculas y acentos", () => assert.equal(coincideBusqueda("baños", ["Banos canchas las lomas"]), true));
test("busca parcial en cualquier campo", () => assert.equal(coincideBusqueda("ht2", ["Molde", null, "SEHHT252"]), true));
test("sin coincidencia", () => assert.equal(coincideBusqueda("taladro", ["Molde", undefined]), false));

test("materialPorNombre encuentra sin distinguir mayusculas, acentos ni espacios extra", () => {
  const ms = [{ id: "1", nombre: "Cable UTP Cat6" }, { id: "2", nombre: "Conector RJ45" }];
  assert.equal(materialPorNombre("  cable utp cat6 ", ms)?.id, "1");
  assert.equal(materialPorNombre("CONECTOR rj45", ms)?.id, "2");
  assert.equal(materialPorNombre("Conectór RJ45", ms)?.id, "2");
  assert.equal(materialPorNombre("Cable", ms), undefined);
  assert.equal(materialPorNombre("   ", ms), undefined);
});
