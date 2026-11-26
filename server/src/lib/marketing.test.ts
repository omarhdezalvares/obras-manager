import { test } from "node:test";
import assert from "node:assert/strict";
import { CANALES, GIROS, marketingSchema } from "./marketing";

test("listas de giro y canal en el orden del spec", () => {
  assert.deepEqual(GIROS, ["Obra civil", "Instalaciones eléctricas", "Voz y datos", "CCTV y seguridad", "Aire acondicionado", "Plomería", "Mantenimiento", "Servicios en campo", "Otro"]);
  assert.deepEqual(CANALES, ["Facebook / Instagram", "Google", "Recomendación", "WhatsApp", "Evento o expo", "Otro"]);
});

test("marketingSchema valida giro y canal", () => {
  assert.deepEqual(marketingSchema.parse({ giro: "Plomería", canal: "Google" }), { giro: "Plomería", canal: "Google", canalDetalle: null });
  assert.equal(marketingSchema.safeParse({ giro: "Plomería", canal: "Otro" }).success, false);
  assert.equal(marketingSchema.safeParse({ giro: "Plomería", canal: "Otro", canalDetalle: "  " }).success, false);
  assert.deepEqual(marketingSchema.parse({ giro: "Otro", canal: "Otro", canalDetalle: " Radio " }), { giro: "Otro", canal: "Otro", canalDetalle: "Radio" });
  assert.equal(marketingSchema.parse({ giro: "Plomería", canal: "Google", canalDetalle: "x" }).canalDetalle, null);
  assert.equal(marketingSchema.safeParse({ giro: "Carpintería", canal: "Google" }).success, false);
  assert.equal(marketingSchema.safeParse({ canal: "Google" }).success, false);
});
