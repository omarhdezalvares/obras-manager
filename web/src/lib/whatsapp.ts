// Enlace wa.me con mensaje; null si no hay un numero usable (el boton no se dibuja).
export function whatsappUrl(numero: string | undefined, mensaje: string): string | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}
