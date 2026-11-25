// Enlace wa.me con mensaje; null si no hay un numero usable (el boton no se dibuja).
export function whatsappUrl(numero: string | undefined, mensaje: string): string | null {
  // wa.me exige lada de pais: un numero local de 10 digitos daria un enlace muerto.
  const digitos = (numero ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (digitos.length < 11) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}
