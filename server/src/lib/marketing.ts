import { z } from "zod";

// Mismos giros que la landing; el orden es el de los selects del registro y del panel.
export const GIROS = ["Obra civil", "Instalaciones eléctricas", "Voz y datos", "CCTV y seguridad", "Aire acondicionado", "Plomería", "Mantenimiento", "Servicios en campo", "Otro"] as const;
export const CANALES = ["Facebook / Instagram", "Google", "Recomendación", "WhatsApp", "Evento o expo", "Otro"] as const;

const detalle = z.string().trim().max(120).optional().nullable();

// "Otro" exige decir cual; con cualquier otro canal el texto se descarta.
export const marketingSchema = z
  .object({ giro: z.enum(GIROS), canal: z.enum(CANALES), canalDetalle: detalle })
  .refine((d) => d.canal !== "Otro" || Boolean(d.canalDetalle), { message: "Escribe cómo te enteraste", path: ["canalDetalle"] })
  .transform((d) => ({ giro: d.giro, canal: d.canal, canalDetalle: d.canal === "Otro" ? d.canalDetalle! : null }));

export type Marketing = z.output<typeof marketingSchema>;

// Correccion desde el panel: cada campo es opcional; mismas reglas para "Otro".
export const marketingParcialSchema = z
  .object({ giro: z.enum(GIROS).optional(), canal: z.enum(CANALES).optional(), canalDetalle: detalle })
  .refine((d) => d.canal !== "Otro" || Boolean(d.canalDetalle), { message: "Escribe cómo se enteró", path: ["canalDetalle"] })
  .transform((d) => ({
    ...(d.giro ? { giro: d.giro } : {}),
    ...(d.canal ? { canal: d.canal, canalDetalle: d.canal === "Otro" ? d.canalDetalle! : null } : {}),
  }));
