import { env } from "../env";
import { HttpError } from "../middleware/auth";

// Correo transaccional via la API REST de Resend (sin dependencia).
export async function enviarCorreo(para: string, asunto: string, html: string): Promise<void> {
  if (!env.resendApiKey) {
    if (env.isProd) throw new HttpError(503, "El envio de correos no esta configurado");
    // eslint-disable-next-line no-console
    console.log(`[correo sin enviar] para=${para} asunto=${asunto}\n${html}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.resendApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.correoRemitente, to: [para], subject: asunto, html }),
  });
  if (!res.ok) throw new HttpError(502, `No se pudo enviar el correo (${res.status})`);
}
