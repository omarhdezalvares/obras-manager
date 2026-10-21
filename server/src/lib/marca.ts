export const COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;

// exceljs usa ARGB sin "#": "#1f4e79" -> "FF1F4E79".
export function colorExcelArgb(hex: string | null | undefined): string | undefined {
  return hex && COLOR_HEX.test(hex) ? `FF${hex.slice(1).toUpperCase()}` : undefined;
}
