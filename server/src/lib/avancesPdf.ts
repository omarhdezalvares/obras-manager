import PDFDocument from "pdfkit";
import { isoLocal } from "./dates";
import { COLOR_HEX, textoSobre } from "./marca";

// Identidad del rediseño: grafito, concreto y naranja de seguridad. El color
// del encabezado sigue siendo el de la empresa (Empresa > Color de reportes).
const ACCENT = "#1F2328";
const NARANJA = "#E0701F";
const INK = "#1C1F23";
const INK_SOFT = "#5B6068";
const BORDE = "#E2E2DE";
const FONDO_SUAVE = "#F5F5F2";

const MARGIN = 48;
const PIE = 40;

const ESTADO_OBRA: Record<string, string> = {
  planeada: "Planeada",
  en_ejecucion: "En ejecución",
  pausada: "Pausada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

interface ObraHeader {
  nombre: string;
  cliente: string | null;
  ubicacion: string | null;
  responsable: string | null;
  estado?: string;
  fechaInicio?: Date | null;
}

interface TenantHeader {
  nombre: string;
  rfc?: string | null;
  direccion: string | null;
  telefono: string | null;
  correoContacto: string | null;
  colorPrimario: string | null;
}

interface Foto {
  datos: Buffer | null; // descargada del bucket; null si no se pudo
  tipoMime: string | null;
  creado?: Date;
}

interface AvanceConEvidencias {
  id: string;
  fecha: Date;
  descripcion: string;
  personas: string[];
  fotos: Foto[];
}

const esImagen = (tipoMime: string | null) => !!tipoMime && tipoMime.startsWith("image/");
export const esImagenCompatible = (tipoMime: string | null) => !!tipoMime && /^image\/(jpe?g|png)$/i.test(tipoMime);
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fechaLarga = (d: Date) => d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
const fechaCorta = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
const hora = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

// Folio legible y estable para el dia de emision; no es un consecutivo guardado.
export function folioReporte(obraId: string, emitido: Date): string {
  return `RE-${isoLocal(emitido).replace(/-/g, "")}-${obraId.slice(0, 4).toUpperCase()}`;
}

export function resumenPeriodo(
  avances: { fecha: Date; fotos: { tipoMime: string | null }[] }[],
  asistencias: { personaId: string }[]
): { dias: number; diasHombre: number; fotos: number; personas: number } {
  return {
    dias: new Set(avances.map((a) => isoLocal(a.fecha))).size,
    diasHombre: asistencias.length,
    fotos: avances.reduce((s, a) => s + a.fotos.filter((f) => esImagen(f.tipoMime)).length, 0),
    personas: new Set(asistencias.map((a) => a.personaId)).size,
  };
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number): void {
  if (doc.y + height > doc.page.height - MARGIN - PIE) {
    doc.addPage();
    doc.y = MARGIN;
  }
}

function etiqueta(doc: PDFKit.PDFDocument, texto: string, x: number, y: number, width?: number) {
  doc.font("Helvetica-Bold").fontSize(7).fillColor(INK_SOFT).text(texto.toUpperCase(), x, y, { width, characterSpacing: 0.6, lineBreak: false });
}

function dibujarFotos(doc: PDFKit.PDFDocument, fotos: Foto[], numero: number, x0: number, ancho: number): void {
  const columnas = 3;
  const gap = 8;
  const celda = (ancho - gap * (columnas - 1)) / columnas;
  const alto = celda * 0.75;
  let col = 0;
  let filaY = doc.y;
  fotos.forEach((foto, i) => {
    if (col === 0) {
      ensureSpace(doc, alto + 18);
      filaY = doc.y;
    }
    const x = x0 + col * (celda + gap);
    let dibujada = false;
    if (esImagenCompatible(foto.tipoMime) && foto.datos) {
      try {
        doc.save().roundedRect(x, filaY, celda, alto, 3).clip();
        doc.image(foto.datos, x, filaY, { cover: [celda, alto], align: "center", valign: "center" });
        doc.restore();
        dibujada = true;
      } catch {
        doc.restore();
      }
    }
    if (!dibujada) {
      doc.roundedRect(x, filaY, celda, alto, 3).fill("#E9E9E5");
      doc.font("Helvetica").fontSize(7.5).fillColor(INK_SOFT).text(esImagen(foto.tipoMime) ? "Imagen no disponible" : "Archivo adjunto (no es imagen)", x + 6, filaY + alto / 2 - 5, { width: celda - 12, align: "center" });
    }
    const pie = `Foto ${numero}.${i + 1}${foto.creado ? ` · ${hora(foto.creado)}` : ""}`;
    doc.font("Helvetica").fontSize(7.5).fillColor(INK_SOFT).text(pie, x, filaY + alto + 3, { width: celda, lineBreak: false });
    col++;
    if (col === columnas) {
      col = 0;
      doc.y = filaY + alto + 16;
    }
  });
  if (col !== 0) doc.y = filaY + alto + 16;
}

export async function generarReporteAvancesPdf(params: {
  obraId?: string;
  obra: ObraHeader;
  tenant: TenantHeader;
  logo?: Buffer | null;
  avances: AvanceConEvidencias[];
  asistencias?: { personaId: string }[];
  desde?: string;
  hasta?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true, info: { Title: `Reporte de evidencias · ${params.obra.nombre}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const util = W - MARGIN * 2;
    const emitido = new Date();
    const folio = folioReporte(params.obraId ?? params.obra.nombre.replace(/\W/g, ""), emitido);

    // Encabezado: banda con el color de la empresa y franja naranja.
    const acento = params.tenant.colorPrimario && COLOR_HEX.test(params.tenant.colorPrimario) ? params.tenant.colorPrimario : ACCENT;
    const texto = textoSobre(acento);
    const suave = texto === "#FFFFFF" ? "#E8E8E4" : "#3A3F46";
    doc.rect(0, 0, W, 86).fill(acento);
    doc.rect(0, 86, W, 3).fill(NARANJA);
    let xTexto = MARGIN;
    if (params.logo) {
      try {
        doc.image(params.logo, MARGIN, 17, { fit: [52, 52], align: "center", valign: "center" });
        xTexto = MARGIN + 64;
      } catch {
        // logo faltante o ilegible: el reporte sale sin logo en vez de fallar
      }
    }
    const anchoDer = 150;
    const anchoTexto = W - MARGIN - anchoDer - 12 - xTexto;
    doc.font("Helvetica-Bold").fontSize(16).fillColor(texto).text(params.tenant.nombre, xTexto, 24, { width: anchoTexto, height: 20, ellipsis: true, lineBreak: false });
    const contacto = [params.tenant.rfc && `RFC ${params.tenant.rfc}`, params.tenant.direccion, params.tenant.telefono, params.tenant.correoContacto].filter(Boolean).join("  ·  ");
    if (contacto) doc.font("Helvetica").fontSize(8).fillColor(suave).text(contacto, xTexto, 46, { width: anchoTexto, height: 22, ellipsis: true });
    const xDer = W - MARGIN - anchoDer;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(suave).text("REPORTE DE EVIDENCIAS", xDer, 22, { width: anchoDer, align: "right", characterSpacing: 0.8 });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(texto).text(folio, xDer, 34, { width: anchoDer, align: "right" });
    doc.font("Helvetica").fontSize(8).fillColor(suave).text(`Emitido ${fechaCorta(emitido)}`, xDer, 52, { width: anchoDer, align: "right" });

    // Obra y ficha tecnica.
    doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text(params.obra.nombre, MARGIN, 108, { width: util });
    let y = doc.y + 8;
    const fechas = params.avances.map((a) => a.fecha).sort((a, b) => a.getTime() - b.getTime());
    const periodo =
      params.desde || params.hasta
        ? `${params.desde ?? "inicio"} al ${params.hasta ?? "hoy"}`
        : fechas.length
          ? `${fechaCorta(fechas[0])} al ${fechaCorta(fechas[fechas.length - 1])}`
          : "Historial completo";
    const celdas: [string, string][] = [
      ["Cliente", params.obra.cliente ?? "—"],
      ["Ubicación", params.obra.ubicacion ?? "—"],
      ["Responsable", params.obra.responsable ?? "—"],
      ["Periodo", periodo],
      ["Estado", params.obra.estado ? ESTADO_OBRA[params.obra.estado] ?? params.obra.estado : "—"],
      ["Inicio de obra", params.obra.fechaInicio ? fechaCorta(params.obra.fechaInicio) : "—"],
    ];
    const cw = util / 3;
    const ch = 34;
    doc.roundedRect(MARGIN, y, util, ch * 2, 5).lineWidth(0.8).stroke(BORDE);
    doc.moveTo(MARGIN, y + ch).lineTo(MARGIN + util, y + ch).stroke(BORDE);
    doc.moveTo(MARGIN + cw, y).lineTo(MARGIN + cw, y + ch * 2).stroke(BORDE);
    doc.moveTo(MARGIN + cw * 2, y).lineTo(MARGIN + cw * 2, y + ch * 2).stroke(BORDE);
    celdas.forEach(([k, v], i) => {
      const cx = MARGIN + (i % 3) * cw + 10;
      const cy = y + Math.floor(i / 3) * ch + 7;
      etiqueta(doc, k, cx, cy, cw - 20);
      doc.font("Helvetica").fontSize(9).fillColor(INK).text(v, cx, cy + 11, { width: cw - 20, height: 12, ellipsis: true, lineBreak: false });
    });
    y += ch * 2 + 18;

    // Resumen del periodo.
    const r = resumenPeriodo(params.avances, params.asistencias ?? []);
    etiqueta(doc, "Resumen del periodo", MARGIN, y);
    y += 13;
    const caja = (util - 3 * 8) / 4;
    ([
      [r.dias, r.dias === 1 ? "día con registro" : "días con registro"],
      [r.diasHombre, "días-hombre"],
      [r.fotos, r.fotos === 1 ? "fotografía" : "fotografías"],
      [r.personas, r.personas === 1 ? "persona en obra" : "personas en obra"],
    ] as [number, string][]).forEach(([n, l], i) => {
      const bx = MARGIN + i * (caja + 8);
      doc.roundedRect(bx, y, caja, 42, 4).fill(FONDO_SUAVE);
      doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(String(n), bx + 10, y + 7, { width: caja - 20, lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor(INK_SOFT).text(l, bx + 10, y + 27, { width: caja - 20, lineBreak: false });
    });
    y += 42 + 20;

    etiqueta(doc, "Registro diario", MARGIN, y);
    doc.y = y + 14;

    if (params.avances.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(INK_SOFT).text("No hay evidencias registradas en el periodo seleccionado.", MARGIN, doc.y + 6, { width: util });
    }

    const xDer2 = MARGIN + 62;
    const anchoDer2 = util - 62;
    params.avances.forEach((avance, idx) => {
      ensureSpace(doc, 70);
      const top = doc.y;
      doc.moveTo(MARGIN, top).lineTo(MARGIN + util, top).lineWidth(0.8).stroke(BORDE);
      const y0 = top + 10;
      // Fecha al costado con barra del color de la empresa.
      doc.font("Helvetica-Bold").fontSize(18).fillColor(INK).text(String(avance.fecha.getDate()), MARGIN, y0, { width: 44, align: "center" });
      const mesDia = avance.fecha.toLocaleDateString("es-MX", { month: "short", weekday: "short" }).replace(/\./g, "").toUpperCase();
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(INK_SOFT).text(mesDia, MARGIN, y0 + 21, { width: 44, align: "center" });
      // La barra va junto a la fecha, en la pagina donde empieza el registro.
      doc.rect(MARGIN + 50, y0, 2, 34).fill(acento === ACCENT ? NARANJA : acento);
      const paginaInicio = doc.bufferedPageRange().count;

      const imagenes = avance.fotos.filter((f) => esImagen(f.tipoMime)).length;
      const tag = imagenes ? `${imagenes} ${imagenes === 1 ? "FOTO" : "FOTOS"}` : "SIN FOTOS";
      doc.font("Helvetica-Bold").fontSize(7);
      const tw = doc.widthOfString(tag) + 10;
      doc.roundedRect(MARGIN + util - tw, y0, tw, 13, 2).fill(imagenes ? "#E3EDF8" : "#FBEFD9");
      doc.fillColor(imagenes ? "#1F4E82" : "#7A4F00").text(tag, MARGIN + util - tw + 5, y0 + 3.5, { lineBreak: false });

      doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(`Registro ${idx + 1} · ${capitalizar(fechaLarga(avance.fecha))}`, xDer2, y0, { width: anchoDer2 - tw - 8 });
      doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(avance.descripcion, xDer2, doc.y + 4, { width: anchoDer2, lineGap: 2 });
      if (avance.personas.length > 0) {
        doc.font("Helvetica").fontSize(8.5).fillColor(INK_SOFT).text(`Personal: ${avance.personas.join(", ")}`, xDer2, doc.y + 4, { width: anchoDer2 });
      }
      if (avance.fotos.length > 0) {
        doc.y += 8;
        dibujarFotos(doc, avance.fotos, idx + 1, xDer2, anchoDer2);
      }
      // Si el registro siguio en otra pagina, y0 ya no aplica: solo se deja el espacio entre registros.
      const mismaPagina = doc.bufferedPageRange().count === paginaInicio;
      doc.y = (mismaPagina ? Math.max(doc.y, y0 + 34) : doc.y) + 10;
    });

    // Firmas de validacion.
    ensureSpace(doc, 130);
    const fy = doc.y + 24;
    etiqueta(doc, "Validación", MARGIN, fy);
    const fw = (util - 2 * 24) / 3;
    [
      ["Responsable de obra", params.obra.responsable ?? ""],
      ["Supervisión", ""],
      ["Cliente", params.obra.cliente ?? ""],
    ].forEach(([rol, nombre], i) => {
      const x = MARGIN + i * (fw + 24);
      doc.moveTo(x, fy + 62).lineTo(x + fw, fy + 62).lineWidth(0.8).stroke(INK_SOFT);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text(rol, x, fy + 68, { width: fw, align: "center" });
      if (nombre) doc.font("Helvetica").fontSize(8).fillColor(INK_SOFT).text(nombre, x, fy + 80, { width: fw, align: "center", height: 10, ellipsis: true });
    });

    // Pie en cada pagina: empresa, folio y obra, y numero de pagina.
    const rango = doc.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      // Sin este ajuste pdfkit cree que el pie se sale del area y agrega una pagina en blanco.
      const margenOriginal = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const py = doc.page.height - 30;
      doc.moveTo(MARGIN, py - 8).lineTo(W - MARGIN, py - 8).lineWidth(0.6).stroke(BORDE);
      doc.font("Helvetica").fontSize(7.5).fillColor(INK_SOFT);
      doc.text(`${params.tenant.nombre} · Reporte ${folio} · ${params.obra.nombre}`, MARGIN, py, { width: util - 80, height: 10, ellipsis: true, lineBreak: false });
      doc.text(`Página ${i + 1} de ${rango.count}`, W - MARGIN - 80, py, { width: 80, align: "right", lineBreak: false });
      doc.page.margins.bottom = margenOriginal;
    }

    doc.end();
  });
}
