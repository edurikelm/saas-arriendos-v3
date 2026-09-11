import type { Prisma } from "@prisma/client";
import { endOfDayInTz, nowKeyInBusinessTz, startOfDayInTz } from "@/lib/domain/timezone";
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
  /** Sobre qué fecha aplica el rango. Ver `DATE_FIELDS`. */
  dateField?: string;
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
 * Campos de fecha sobre los que se puede filtrar, con la clave de la VISTA.
 *
 * Los tres NO son del mismo tipo, y ahí está el filo:
 *
 * - `createdAt` y `paidAt` son INSTANTES reales. Su día es el día de pared en
 *   la zona del negocio, así que sus bordes salen de `startOfDayInTz` /
 *   `endOfDayInTz`. Un cobro registrado a las 21:34 de Santiago pertenece a ese
 *   día aunque se guarde como 00:34 UTC del siguiente.
 * - `dueDate` es DATE-ONLY. El dominio lo compara por clave `YYYY-MM-DD` sobre
 *   su fecha UTC (`dateOnlyKey`), y en producción sus valores conviven a las
 *   00:00, 03:00 y 04:00 UTC del día que representan. Aplicarle bordes de
 *   Santiago lo correría 3 o 4 horas y dejaría fuera los de medianoche.
 *
 * Por eso el rango no se construye igual para todos.
 */
export const DATE_FIELDS = {
  emision: "createdAt",
  pago: "paidAt",
  vencimiento: "dueDate",
} as const;

export type PaymentsDateFieldKey = keyof typeof DATE_FIELDS;

export const DEFAULT_DATE_FIELD: PaymentsDateFieldKey = "emision";

export function isPaymentsDateField(value: string | undefined): value is PaymentsDateFieldKey {
  return value != null && value in DATE_FIELDS;
}

/** Medianoche UTC del día `key`: el inicio de un campo DATE-ONLY. */
function dateOnlyStart(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Último instante del día `key` para un campo DATE-ONLY. */
function dateOnlyEnd(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  // El día siguiente se deriva de la CLAVE y no sumando 24h, para no depender
  // de que el día tenga 24 horas.
  return new Date(Date.UTC(year, month - 1, day + 1) - 1);
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
  return dateOnlyStart(todayKey);
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

  // Rango de fechas sobre el campo elegido.
  //
  // Antes cada borde se construía distinto y ninguno era Santiago:
  // `new Date("2026-09-01")` es medianoche UTC —la forma date-only del estándar
  // se interpreta en UTC— y `new Date("2026-09-01T23:59:59")` es hora LOCAL DEL
  // PROCESO. Los dos extremos del mismo rango no compartían referencia, y el
  // resultado cambiaba entre la máquina de desarrollo y el deploy.
  //
  // Ahora cada borde se construye según el TIPO del campo (ver `DATE_FIELDS`),
  // que no es el mismo para los tres: dos son instantes y uno es date-only.
  const fieldKey = isPaymentsDateField(filters.dateField)
    ? filters.dateField
    : DEFAULT_DATE_FIELD;
  const field = DATE_FIELDS[fieldKey];
  const esDateOnly = field === "dueDate";

  if (filters.dateFrom || filters.dateTo) {
    const range: { gte?: Date; lte?: Date } = {};

    if (filters.dateFrom) {
      range.gte = esDateOnly
        ? dateOnlyStart(filters.dateFrom)
        : startOfDayInTz(filters.dateFrom);
    }
    if (filters.dateTo) {
      range.lte = esDateOnly ? dateOnlyEnd(filters.dateTo) : endOfDayInTz(filters.dateTo);
    }

    // Filtrar por `paidAt` o `dueDate` deja fuera los pagos que no los tienen,
    // y eso es lo correcto: un cobro sin pagar no "se pagó en septiembre", y
    // uno sin cuota no vence.
    where[field] = range;
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
