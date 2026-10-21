import { test } from "node:test";
import assert from "node:assert/strict";
import { colorExcelArgb } from "./marca";

test("hex a ARGB opaco de exceljs", () => assert.equal(colorExcelArgb("#1f4e79"), "FF1F4E79"));
test("sin color no hay ARGB", () => assert.equal(colorExcelArgb(null), undefined));
test("hex invalido se ignora", () => assert.equal(colorExcelArgb("rojo"), undefined));
