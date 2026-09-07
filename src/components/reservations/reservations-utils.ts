// Shared helpers for reservations components

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

/**
 * Iniciales del huésped para el avatar de la lista.
 *
 * Toma la PRIMERA letra de las dos primeras palabras. La tabla desktop tenía
 * su propia copia que usaba `part[part.length - 1]` (la ÚLTIMA letra), así que
 * "Carlos Rojas" salía "SS" y "Ana Soto" salía "AO"; la tarjeta móvil usaba la
 * regla correcta. Las dos implementaciones discrepaban en las 9 formas de
 * nombre presentes en producción, y varios huéspedes distintos colapsaban en
 * las mismas iniciales — justo lo contrario de lo que el avatar existe para
 * hacer. Una sola función para los dos callsites.
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
