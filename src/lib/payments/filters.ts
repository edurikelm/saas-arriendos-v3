import type { Prisma } from "@prisma/client";
import { nowKeyInBusinessTz } from "@/lib/domain/timezone";
import { parseAmountQuery } from "@/lib/payments/search";

/**
 * Construcción del `where` del listado de `/payments`, en un solo lugar.
 *
 * Existe porque la tabla y sus KPIs tienen que describir exactamente el mismo
 * conjunto de filas. Mientras cada uno armaba su propio filtro, las cifras de
 * arriba hablaban de todo el negocio y la tabla de abajo de lo filtrado, sin
 * nada que lo señalara: filtrabas una propiedad y un mes, la tabla cambiaba y
 * los KPIs se quedaban iguales.
 */

export interface PaymentsFilters {
  reservationId?: string;
  status?: string;
  method?: string;
  propertyId?: string;
  paymentType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

const STATUSES = ["PENDING", "COMPLETED", "FAILED"] as const;
const METHODS = ["MERCADO_PAGO", "CASH", "TRANSFER"] as const;
const PAYMENT_TYPES = ["RESERVATION", "EXTRA"] as const;

/**
 * Valida que el valor venga de la lista blanca Y se lo dice al compilador.
 *
 * Los filtros llegan de la URL como `string`, o sea que cualquiera puede
 * escribir `?status=CUALQUIERA`. Sin el predicado de tipo, Prisma recibiría un
 * `string` donde espera su enum y TypeScript lo rechazaría; con él, el mismo
 * chequeo que descarta basura estrecha el tipo.
 */
function isOneOf<T extends readonly string[]>(
  allowed: T,
  value: string | undefined,
): value is T[number] {
  return value != null && (allowed as readonly string[]).includes(value);
}

/**
 * Instante a partir del cual una cuota ya NO está vencida: la medianoche UTC
 * del día de hoy en la zona del negocio.
 *
 * El dominio trata `dueDate` como campo date-only y lo compara por clave
 * (`isOverdueDateOnly`: `dateOnlyKey(d) < nowKeyInBusinessTz()`). `dateOnlyKey`
 * sobre un `Date` es `toISOString().slice(0, 10)`, o sea la fecha UTC — así que
 * este corte es EXACTAMENTE equivalente a esa comparación de strings, y sirve
 * para preguntárselo a la base en vez de a JavaScript fila por fila.
 *
 * Importa que sea equivalente y no "parecido": los `dueDate` reales no están
 * guardados a medianoche. En producción conviven las 00:00, 03:00 y 04:00 UTC
 * del día que representan. Cualquiera de esas horas cae del lado correcto de
 * este corte, porque comparte el día UTC con su clave.
 */
export function overdueBoundary(todayKey: string = nowKeyInBusinessTz()): Date {
  return new Date(`${todayKey}T00:00:00.000Z`);
}

/**
 * Traduce los filtros de la vista a un `where` de Prisma, siempre anclado a las
 * reservas del owner.
 *
 * El ancla va en el objeto base y no en cada callsite para que ninguna query
 * derivada pueda perderla. Ver el commit que la introdujo: antes `findMany` y
 * `count` corrían sin ella y el listado devolvía los pagos de todas las cuentas.
 */
export function buildPaymentsWhere(
  userId: string,
  filters: PaymentsFilters = {},
): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = {
    reservation: { userId },
  };

  if (filters.reservationId) {
    where.reservationId = filters.reservationId;
  }

  if (isOneOf(STATUSES, filters.status)) {
    where.status = filters.status;
  }

  if (isOneOf(METHODS, filters.method)) {
    where.method = filters.method;
  }

  if (isOneOf(PAYMENT_TYPES, filters.paymentType)) {
    where.paymentType = filters.paymentType;
  }

  if (filters.dateFrom) {
    where.createdAt = { ...(where.createdAt as object), gte: new Date(filters.dateFrom) };
  }

  if (filters.dateTo) {
    where.createdAt = {
      ...(where.createdAt as object),
      lte: new Date(filters.dateTo + "T23:59:59"),
    };
  }

  // Se mergea sobre el `userId` del where base, no lo reemplaza.
  if (filters.propertyId) {
    where.reservation = { ...(where.reservation as object), propertyId: filters.propertyId };
  }

  // Búsqueda libre sobre las cuatro cosas por las que se busca un cobro: quién
  // lo debe, de qué propiedad, de qué se trata y de cuánto es.
  //
  // Va como cláusula de un `AND` y no asignando `where.OR` directo: el `OR`
  // suelto es una sola clave del objeto, así que un segundo filtro que también
  // quisiera usarla pisaría a este en silencio. Mismo criterio que
  // `getReservations`.
  const search = filters.search?.trim();
  if (search) {
    const amount = parseAmountQuery(search);

    where.AND = [
      {
        OR: [
          { reservation: { client: { name: { contains: search, mode: "insensitive" } } } },
          { reservation: { property: { name: { contains: search, mode: "insensitive" } } } },
          // `title` y `description` solo existen en cobros EXTRA; en los de
          // arriendo son null y `contains` simplemente no calza.
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          // Monto exacto. Un `startsWith` sobre los dígitos pediría castear la
          // columna a texto en SQL, y "busco el pago de 450.000" es la forma
          // real en que alguien busca por monto — no por prefijo.
          ...(amount !== null ? [{ amount: { equals: amount } }] : []),
        ],
      },
    ];
  }

  return where;
}
