import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { env } from "../env";

const ACCENT = "#5C4632";
const INK = "#2A2622";
const INK_SOFT = "#6B6258";
const BORDE = "#E4DCCF";
const FONDO_SUAVE = "#F1EEE7";

const MARGIN = 48;

interface ObraHeader {
  nombre: string;
  cliente: string | null;
  ubicacion: string | null;
  responsable: string | null;
}

interface TenantHeader {
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  correoContacto: string | null;
}

interface AvanceConEvidencias {
  id: string;
  fecha: Date;
  descripcion: string;
  personas: string[];
  fotos: { objectKey: string; tipoMime: string | null }[];
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatoFechaLarga(d: Date): string {
  return capitalizar(d.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) doc.addPage();
}

function esImagenCompatible(tipoMime: string | null): boolean {
  return !!tipoMime && /^image\/(jpe?g|png)$/i.test(tipoMime);
}

function dibujarCuadriculaFotos(doc: PDFKit.PDFDocument, fotos: { objectKey: string; tipoMime: string | null }[]): void {
  const columnas = 3;
  const gap = 8;
  const anchoUtil = doc.page.width - MARGIN * 2;
  const celda = (anchoUtil - gap * (columnas - 1)) / columnas;

  let col = 0;
  let filaY = doc.y;

  for (const foto of fotos) {
    if (col === 0) {
      ensureSpace(doc, celda + gap);
      filaY = doc.y;
    }
    const x = MARGIN + col * (celda + gap);
    const rutaArchivo = path.join(env.uploadDir, foto.objectKey);
    let dibujada = false;
    if (esImagenCompatible(foto.tipoMime) && fs.existsSync(rutaArchivo)) {
      try {
        doc.image(rutaArchivo, x, filaY, { fit: [celda, celda], align: "center", valign: "center" });
        dibujada = true;
      } catch {
        dibujada = false;
      }
    }
    if (!dibujada) {
      doc.rect(x, filaY, celda, celda).fillAndStroke(FONDO_SUAVE, BORDE);
      doc
        .fontSize(7)
        .fillColor(INK_SOFT)
        .text("Adjunto no\nvisualizable", x + 4, filaY + celda / 2 - 8, { width: celda - 8, align: "center" });
    }

    col++;
    if (col === columnas) {
      col = 0;
      doc.y = filaY + celda + gap;
    }
  }
  if (col !== 0) doc.y = filaY + celda + gap;
  doc.x = MARGIN;
}

export async function generarReporteAvancesPdf(params: {
  obra: ObraHeader;
  tenant: TenantHeader;
  avances: AvanceConEvidencias[];
  desde?: string;
  hasta?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Encabezado con la identidad de la empresa que envia el reporte.
    doc.rect(0, 0, doc.page.width, 92).fill(ACCENT);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18).text(params.tenant.nombre, MARGIN, 26);
    const contacto = [params.tenant.direccion, params.tenant.telefono, params.tenant.correoContacto].filter(Boolean).join("   ·   ");
    doc.font("Helvetica").fontSize(9).fillColor(FONDO_SUAVE);
    if (contacto) doc.text(contacto, MARGIN, 50);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#FFFFFF").text("Reporte de evidencias de obra", MARGIN, 68);

    // Ficha de la obra.
    const fichaY = 116;
    const fichaAlto = 84;
    doc.roundedRect(MARGIN, fichaY, doc.page.width - MARGIN * 2, fichaAlto, 6).stroke(BORDE);
    doc.font("Helvetica-Bold").fontSize(14).fillColor(INK).text(params.obra.nombre, MARGIN + 14, fichaY + 12, { width: 280 });
    doc.font("Helvetica").fontSize(9.5).fillColor(INK_SOFT);
    let filaIzq = fichaY + 34;
    if (params.obra.cliente) {
      doc.text(`Cliente: ${params.obra.cliente}`, MARGIN + 14, filaIzq, { width: 280 });
      filaIzq += 15;
    }
    if (params.obra.ubicacion) {
      doc.text(`Ubicacion: ${params.obra.ubicacion}`, MARGIN + 14, filaIzq, { width: 280 });
    }

    const colDerX = MARGIN + 300;
    const periodo =
      params.desde || params.hasta
        ? `Periodo: ${params.desde ?? "inicio"} a ${params.hasta ?? "hoy"}`
        : "Periodo: historial completo";
    doc.text(periodo, colDerX, fichaY + 12, { width: 190 });
    doc.text(`Generado el: ${new Date().toLocaleDateString("es-MX")}`, colDerX, fichaY + 34, { width: 190 });
    if (params.obra.responsable) doc.text(`Responsable: ${params.obra.responsable}`, colDerX, fichaY + 56, { width: 190 });

    doc.x = MARGIN;
    doc.y = fichaY + fichaAlto + 24;

    if (params.avances.length === 0) {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(INK_SOFT)
        .text("No hay evidencias registradas en el periodo seleccionado.", MARGIN, doc.y, { width: doc.page.width - MARGIN * 2 });
    }

    for (const avance of params.avances) {
      ensureSpace(doc, 48);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(ACCENT).text(formatoFechaLarga(avance.fecha), MARGIN, doc.y, {
        width: doc.page.width - MARGIN * 2,
      });
      doc
        .moveTo(MARGIN, doc.y + 3)
        .lineTo(doc.page.width - MARGIN, doc.y + 3)
        .strokeColor(BORDE)
        .stroke();
      doc.moveDown(0.6);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(INK)
        .text(avance.descripcion, MARGIN, doc.y, { width: doc.page.width - MARGIN * 2 });

      if (avance.personas.length > 0) {
        doc.moveDown(0.3);
        doc
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(INK_SOFT)
          .text(`Personal en obra: ${avance.personas.join(", ")}`, MARGIN, doc.y, { width: doc.page.width - MARGIN * 2 });
      }

      if (avance.fotos.length > 0) {
        doc.moveDown(0.5);
        dibujarCuadriculaFotos(doc, avance.fotos);
      }

      doc.moveDown(1.2);
    }

    const rango = doc.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      // El pie va dentro del margen inferior de la pagina: sin este ajuste
      // pdfkit interpreta que el texto se sale del area imprimible y agrega
      // una pagina en blanco extra solo para "hacerle espacio".
      const margenInferiorOriginal = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(INK_SOFT)
        .text(`Pagina ${i + 1} de ${rango.count}`, MARGIN, doc.page.height - 32, {
          width: doc.page.width - MARGIN * 2,
          align: "center",
        });
      doc.page.margins.bottom = margenInferiorOriginal;
    }

    doc.end();
  });
}
