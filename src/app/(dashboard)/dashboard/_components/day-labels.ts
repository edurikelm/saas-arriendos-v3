import { dateKeyToDayIndex, formatDateOnly } from "@/lib/domain/timezone";

/**
 * Etiquetas de día del inicio. Todas reciben claves `YYYY-MM-DD` (date-only
 * del dominio o `todayKey` en wall-time Santiago) y formatean con
 * `formatDateOnly`, que no reinterpreta zona: el día que se muestra es el de
 * la clave, sin importar dónde corra el render.
 */

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function daysBetween(fromKey: string, toKey: string): number {
  return dateKeyToDayIndex(toKey) - dateKeyToDayIndex(fromKey);
}

/**
 * "14 sept", o "14 sept 2027" si el año no es el de hoy. Sin el año, una
 * llegada de enero vista en diciembre se leería como del mismo enero que ya
 * pasó.
 */
export function shortDate(dateKey: string, todayKey: string): string {
  const sameYear = dateKey.slice(0, 4) === todayKey.slice(0, 4);
  return formatDateOnly(dateKey, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
}

/**
 * Día relativo en minúscula, para ir dentro de una frase: "hoy", "mañana",
 * "vie 18", o "jue 1 oct" cuando cae en otro mes. El mes se agrega solo si
 * cambia, porque "vie 18" al lado de la fecha de hoy ya es inequívoco.
 *
 * Solo recibe fechas de hoy en adelante. Existía un "ayer" para la última
 * noche de una salida de hoy, que la agenda ya no muestra: en una salida es
 * siempre la víspera.
 */
export function relativeDayInline(dateKey: string, todayKey: string): string {
  const diff = daysBetween(todayKey, dateKey);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  const weekday = formatDateOnly(dateKey, { weekday: "short" });
  if (dateKey.slice(0, 7) === todayKey.slice(0, 7)) {
    return `${weekday} ${Number(dateKey.slice(8, 10))}`;
  }
  return `${weekday} ${shortDate(dateKey, todayKey)}`;
}

/**
 * Encabezado de un día de la agenda: "Hoy", "Mañana", "Viernes 18", o
 * "Jueves 1 de octubre" cuando cae en otro mes.
 */
export function agendaDayHeading(dateKey: string, todayKey: string): string {
  const diff = daysBetween(todayKey, dateKey);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  const weekday = capitalize(formatDateOnly(dateKey, { weekday: "long" }));
  const day = Number(dateKey.slice(8, 10));
  if (dateKey.slice(0, 7) === todayKey.slice(0, 7)) return `${weekday} ${day}`;
  return `${weekday} ${day} de ${formatDateOnly(dateKey, { month: "long" })}`;
}

/** Título del inicio: "Lunes 14 de septiembre". */
export function longDayTitle(dateKey: string): string {
  const weekday = capitalize(formatDateOnly(dateKey, { weekday: "long" }));
  const day = Number(dateKey.slice(8, 10));
  return `${weekday} ${day} de ${formatDateOnly(dateKey, { month: "long" })}`;
}

/** Nombre del mes de una clave `YYYY-MM`: "septiembre". */
export function monthName(monthKey: string): string {
  return formatDateOnly(`${monthKey}-01`, { month: "long" });
}
