import { test } from "node:test";
import assert from "node:assert/strict";
import { coincideBusqueda } from "./busqueda";

test("busqueda vacia coincide con todo", () => assert.equal(coincideBusqueda("  ", ["x"]), true));
test("ignora mayusculas y acentos", () => assert.equal(coincideBusqueda("baños", ["Banos canchas las lomas"]), true));
test("busca parcial en cualquier campo", () => assert.equal(coincideBusqueda("ht2", ["Molde", null, "SEHHT252"]), true));
test("sin coincidencia", () => assert.equal(coincideBusqueda("taladro", ["Molde", undefined]), false));
