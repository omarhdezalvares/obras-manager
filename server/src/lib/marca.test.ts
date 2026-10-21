import { test } from "node:test";
import assert from "node:assert/strict";
import { colorExcelArgb, textoSobre } from "./marca";

test("hex a ARGB opaco de exceljs", () => assert.equal(colorExcelArgb("#1f4e79"), "FF1F4E79"));
test("sin color no hay ARGB", () => assert.equal(colorExcelArgb(null), undefined));
test("hex invalido se ignora", () => assert.equal(colorExcelArgb("rojo"), undefined));

test("texto blanco sobre color oscuro", () => assert.equal(textoSobre("#1F4E79"), "#FFFFFF"));
test("texto negro sobre color claro", () => assert.equal(textoSobre("#FFFF00"), "#000000"));
test("sin color usa blanco (fondo predeterminado oscuro)", () => assert.equal(textoSobre(null), "#FFFFFF"));
