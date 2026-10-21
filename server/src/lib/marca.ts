export const COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;

// exceljs usa ARGB sin "#": "#1f4e79" -> "FF1F4E79".
export function colorExcelArgb(hex: string | null | undefined): string | undefined {
  return hex && COLOR_HEX.test(hex) ? `FF${hex.slice(1).toUpperCase()}` : undefined;
}

// Texto legible sobre el color de marca (luminancia relativa simple); sin
// color se usa el fondo predeterminado, que es oscuro.
export function textoSobre(hex: string | null | undefined): "#FFFFFF" | "#000000" {
  if (!hex || !COLOR_HEX.test(hex)) return "#FFFFFF";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#000000" : "#FFFFFF";
}
