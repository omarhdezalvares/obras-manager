import { env } from "../env";
import { HttpError } from "../middleware/auth";

export interface ContenidoCorreo {
  titulo: string;
  parrafos: string[];
  boton: { texto: string; link: string };
  nota?: string;
}

// Plantilla con tablas y estilos en linea: es lo unico que respetan Gmail y Outlook. Sin SVG (Gmail lo bloquea).
function plantilla({ titulo, parrafos, boton, nota }: ContenidoCorreo): string {
  const fuente = "'IBM Plex Sans',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#F3F3F1;">
<div style="display:none;max-height:0;overflow:hidden;">${parrafos[0]}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F3F1;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E2DE;border-radius:8px;overflow:hidden;">
    <tr><td style="background:#1F2328;padding:20px 32px;border-bottom:4px solid #E0701F;">
      <div style="font-family:${fuente};font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:0.3px;">Bitácora</div>
      <div style="font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;color:#C9CCD1;text-transform:uppercase;letter-spacing:2px;margin-top:2px;">Plataforma de control de obras</div>
    </td></tr>
    <tr><td style="padding:32px;font-family:${fuente};color:#1C1F23;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:28px;font-weight:600;color:#1C1F23;">${titulo}</h1>
      ${parrafos.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#1C1F23;">${p}</p>`).join("")}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
        <td style="background:#B4500C;border-radius:6px;">
          <a href="${boton.link}" style="display:inline-block;padding:12px 24px;font-family:${fuente};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">${boton.texto}</a>
        </td>
      </tr></table>
      ${nota ? `<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:#5B6068;">${nota}</p>` : ""}
      <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #E2E2DE;font-size:12px;line-height:18px;color:#5B6068;">
        ¿El botón no funciona? Copia este link en tu navegador:<br>
        <a href="${boton.link}" style="color:#8A3D09;word-break:break-all;">${boton.link}</a>
      </p>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font-family:${fuente};font-size:12px;line-height:18px;color:#5B6068;">Bitácora · Este es un correo automático, no lo respondas.</p>
</td></tr>
</table>
</body></html>`;
}

// Version de texto plano: mejora la entrega y la leen los clientes sin HTML.
function textoPlano({ titulo, parrafos, boton, nota }: ContenidoCorreo): string {
  return [titulo, ...parrafos, `${boton.texto}: ${boton.link}`, nota, "— Bitácora"].filter(Boolean).join("\n\n");
}

// Correo transaccional via la API REST de Resend (sin dependencia).
export async function enviarCorreo(para: string, asunto: string, contenido: ContenidoCorreo): Promise<void> {
  const html = plantilla(contenido);
  const text = textoPlano(contenido);
  if (!env.resendApiKey) {
    if (env.isProd) throw new HttpError(503, "El envio de correos no esta configurado");
    // eslint-disable-next-line no-console
    console.log(`[correo sin enviar] para=${para} asunto=${asunto}\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.resendApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.correoRemitente, to: [para], subject: asunto, html, text }),
  });
  if (!res.ok) throw new HttpError(502, `No se pudo enviar el correo (${res.status})`);
}
