/**
 * Comisiones de captadores — lógica pura.
 *
 * Fuente de verdad: ADR-0040.
 *
 * Reglas que este módulo encarna:
 * - **La tasa es un PORCENTAJE, no una fracción.** `10` significa 10%. El
 *   cálculo divide por 100. Es el error de factor 100 más fácil de cometer acá,
 *   porque una comisión de 0,1% se parece bastante a un redondeo.
 * - **La tasa viene congelada en la reserva** (`Reservation.commissionRate`),
 *   nunca del captador. Eso es lo que permite derivar el monto en cada lectura
 *   en vez de guardarlo: corregir el porcentaje por defecto de un captador no
 *   puede mover lo ya registrado (ADR-0040 §2 y §3).
 * - **Se redondea por pago y después se suma**, no al revés, para que el total
 *   que muestra una vista sea exactamente la suma del detalle que la acompaña
 *   (ADR-0040 §8).
 * - **Base bruta**: el monto del pago, sin descontar la comisión de Mercado
 *   Pago (ADR-0040 §4).
 *
 * Qué NO vive acá: el predicado de qué pago comisiona (`COMPLETED` +
 * `RESERVATION` + no borrado) se aplica en el `where` de Prisma, en
 * `./queries.ts`, para no tener dos copias de la misma regla.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Un pago cobrado, con el captador y la tasa que le corresponden por su reserva.
 * Lo produce `./queries.ts`; el builder es puro y no sabe de Prisma.
 */
export interface CommissionPaymentInput {
  paymentId: string;
  reservationId: string;
  amount: number;
  brokerId: string;
  brokerName: string;
  /** Porcentaje congelado en la reserva: 10 = 10%. */
  commissionRate: number;
  /**
   * Etiquetas de la reserva, para que el detalle se pueda leer sin abrir otra
   * pantalla. Viajan ya serializadas (`YYYY-MM-DD` y nombre) porque el consumo
   * es una vista: el módulo no hace nada con ellas más que pasarlas.
   */
  clientName: string;
  propertyName: string;
  startDateKey: string;
  endDateKey: string;
}

/** Total devengado por un captador en el período consultado. */
export interface BrokerCommissionRow {
  brokerId: string;
  brokerName: string;
  /** Cobrado de las reservas de este captador en el período (bruto). */
  collectedAmount: number;
  /** Comisión devengada: suma de los redondeos por pago. */
  commission: number;
  paymentCount: number;
  reservationCount: number;
}

/** Detalle de una reserva dentro del total de un captador. */
export interface ReservationCommissionRow {
  reservationId: string;
  /** Porcentaje congelado de esa reserva. */
  commissionRate: number;
  collectedAmount: number;
  commission: number;
  paymentCount: number;
  clientName: string;
  propertyName: string;
  startDateKey: string;
  endDateKey: string;
}

// ─── Cálculo ──────────────────────────────────────────────────────────────────

/**
 * Comisión de un pago, redondeada al peso.
 *
 * @param amount monto del pago (bruto, sin descontar la comisión de MP)
 * @param rate porcentaje congelado en la reserva: `10` = 10%, no `0.1`
 */
export function commissionForPayment(amount: number, rate: number): number {
  return Math.round((amount * rate) / 100);
}

/**
 * Suma de comisiones de varios pagos que comparten la tasa de una reserva.
 *
 * Redondea cada pago y después suma: el total de una reserva es la suma de las
 * comisiones de sus cuotas, que es lo que el owner le va a mostrar al captador.
 */
export function commissionForPayments(
  payments: { amount: number }[],
  rate: number,
): number {
  return payments.reduce(
    (total, p) => total + commissionForPayment(p.amount, rate),
    0,
  );
}

// ─── Agregación ───────────────────────────────────────────────────────────────

/**
 * Agrupa pagos cobrados por captador.
 *
 * Cada pago aporta con la tasa de SU reserva: dos reservas del mismo captador
 * con porcentajes distintos suman cada una con el suyo. Ordena por comisión
 * descendente — el captador al que más se le debe, primero.
 */
export function buildBrokerCommissions(
  payments: CommissionPaymentInput[],
): BrokerCommissionRow[] {
  const byBroker = new Map<
    string,
    BrokerCommissionRow & { reservationIds: Set<string> }
  >();

  for (const p of payments) {
    let row = byBroker.get(p.brokerId);
    if (!row) {
      row = {
        brokerId: p.brokerId,
        brokerName: p.brokerName,
        collectedAmount: 0,
        commission: 0,
        paymentCount: 0,
        reservationCount: 0,
        reservationIds: new Set<string>(),
      };
      byBroker.set(p.brokerId, row);
    }

    row.collectedAmount += p.amount;
    row.commission += commissionForPayment(p.amount, p.commissionRate);
    row.paymentCount += 1;
    row.reservationIds.add(p.reservationId);
  }

  return [...byBroker.values()]
    .map(({ reservationIds, ...row }) => ({
      ...row,
      reservationCount: reservationIds.size,
    }))
    .sort((a, b) => b.commission - a.commission);
}

/**
 * Detalle por reserva de UN captador — lo que justifica su total.
 *
 * Filtra por `brokerId` acá en vez de pedir otra consulta: los pagos del
 * período ya están en memoria.
 */
export function buildReservationCommissions(
  payments: CommissionPaymentInput[],
  brokerId: string,
): ReservationCommissionRow[] {
  const byReservation = new Map<string, ReservationCommissionRow>();

  for (const p of payments) {
    if (p.brokerId !== brokerId) continue;

    let row = byReservation.get(p.reservationId);
    if (!row) {
      row = {
        reservationId: p.reservationId,
        commissionRate: p.commissionRate,
        collectedAmount: 0,
        commission: 0,
        paymentCount: 0,
        clientName: p.clientName,
        propertyName: p.propertyName,
        startDateKey: p.startDateKey,
        endDateKey: p.endDateKey,
      };
      byReservation.set(p.reservationId, row);
    }

    row.collectedAmount += p.amount;
    row.commission += commissionForPayment(p.amount, p.commissionRate);
    row.paymentCount += 1;
  }

  return [...byReservation.values()].sort(
    (a, b) => b.commission - a.commission,
  );
}

/** Total de comisiones de todas las filas. Para el encabezado del bloque. */
export function sumCommissions(rows: BrokerCommissionRow[]): number {
  return rows.reduce((total, row) => total + row.commission, 0);
}
