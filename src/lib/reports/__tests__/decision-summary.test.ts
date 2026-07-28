/**
 * Tests para el módulo ReportDecisionSummary.
 *
 * Testing strategy: tests through the public seam (pure functions exported by the module),
 * not through the server action. The seam accepts serializable inputs and is fully unit-testable.
 *
 * Key behaviors tested:
 * 1. collectedCash — ALL COMPLETED RESERVATION payments with paidAt in semi-open range [rangeStart, rangeEnd).
 *    CANCELLED reservations INCLUDED (collectedCashFromCancelledReservations is subtotal within collectedCash).
 * 2. outstandingBalance — max(totalPrice - ALL completed RESERVATION payments, 0) for non-CANCELLED
 *    reservations intersecting the range. Uses paid-to-date, NOT limited to range.
 * 3. occupiedNightUnits / capacityNightUnits / occupancyRate — date-only intersection × unitsBooked
 * 4. reservationCount — distinct non-CANCELLED reservation IDs intersecting range.
 * 5. byBillingType DAILY/MONTHLY grouping
 * 6. byProperty includes ALL properties in scope, even zero-value ones (array, not Map).
 * 7. activity NONE/DAILY/MONTHLY/MIXED per property (NONE for no-activity properties).
 * 8. Payment EXTRA never enters any metric.
 * 9. Date-only clipNightsToRange: timezone-agnostic, Jan 1-31 = 31 days, Feb1 does NOT intersect Jan.
 * 10. Semi-open cash range: paidAt >= rangeStart && paidAt < rangeEnd.
 */

import { describe, expect, it } from "vitest";
import {
  buildDecisionSummary,
  clipNightsToRange,
  type DecisionSummaryInput,
  type ReportDecisionSummary,
  type DecisionByPropertyEntry,
  type DecisionByBillingTypeEntry,
  type DecisionActivity,
} from "@/lib/reports/decision-summary";
import { getReservationPaidAmount } from "@/lib/payments/calculations";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Jan 1-31 date-only = 31 days (timezone-agnostic epoch-day arithmetic)
const JAN_2026_START = new Date("2026-01-01T00:00:00.000Z");
const JAN_2026_END = new Date("2026-01-31T23:59:59.999Z");

function makeProperty(id: string, name: string, unitsAvailable: number) {
  return { id, name, unitsAvailable };
}

function makePayment(overrides: {
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  paymentType: "RESERVATION" | "EXTRA";
  paidAt?: Date | null;
  deletedAt?: Date | null;
  dueDate?: Date | null;
}) {
  return {
    id: `pay-${Math.random().toString(36).slice(2)}`,
    amount: overrides.amount,
    status: overrides.status,
    paymentType: overrides.paymentType,
    paidAt: overrides.paidAt ?? null,
    deletedAt: overrides.deletedAt ?? null,
    dueDate: overrides.dueDate ?? null,
  };
}

function makeReservation(overrides: {
  id: string;
  propertyId: string;
  billingType: "DAILY" | "MONTHLY";
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  unitsBooked?: number;
  payments?: ReturnType<typeof makePayment>[];
}) {
  return {
    id: overrides.id,
    propertyId: overrides.propertyId,
    billingType: overrides.billingType,
    status: overrides.status,
    startDate: overrides.startDate,
    endDate: overrides.endDate,
    totalPrice: overrides.totalPrice,
    unitsBooked: overrides.unitsBooked ?? 1,
    payments: overrides.payments ?? [],
  };
}

// ─── Test suites ───────────────────────────────────────────────────────────────

describe("buildDecisionSummary — collectedCash", () => {
  it("sums COMPLETED RESERVATION payments with paidAt in range", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 150000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-10") }),
          makePayment({ amount: 150000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-12") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.collectedCash).toBe(300000);
  });

  it("excludes COMPLETED payments outside the paidAt range (day after rangeEnd)", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-02-01") }), // day after rangeEnd — excluded
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.collectedCash).toBe(0);
  });

  it("includes COMPLETED payments with paidAt exactly on rangeEnd", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-31T12:00:00.000Z") }), // exactly on rangeEnd Jan 31
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.collectedCash).toBe(300000); // counts
  });

  it("excludes PENDING payments", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 300000, status: "PENDING", paymentType: "RESERVATION" }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.collectedCash).toBe(0);
  });

  it("excludes EXTRA paymentType", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 30000, status: "COMPLETED", paymentType: "EXTRA", paidAt: new Date("2026-01-10") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.collectedCash).toBe(0);
  });

  it("excludes soft-deleted payments", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-10"), deletedAt: new Date("2026-01-11") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.collectedCash).toBe(0);
  });

  it("cash counted for reservation whose stay does NOT intersect range but payment paidAt IS in range", () => {
    // Stay: Feb 1-5 2026 (does NOT intersect Jan 1-31 range)
    // Payment: Jan 20 2026 (paidAt IS within Jan range)
    // → cash must be counted because paidAt determines cash period, not stay dates
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-02-01T00:00:00.000Z"),
        endDate: new Date("2026-02-05T00:00:00.000Z"),
        totalPrice: 500000,
        payments: [
          makePayment({ amount: 500000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-20T12:00:00.000Z") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    // Jan 20 payment is in range → counted in collectedCash
    expect(result.collectedCash).toBe(500000);
    // Stay does NOT intersect Jan → 0 occupied nights
    expect(result.occupiedNightUnits).toBe(0);
  });
});

describe("buildDecisionSummary — collectedCashFromCancelledReservations", () => {
  it("CANCELLED cash is INCLUDED in collectedCash; subtotal tracked separately", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CANCELLED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-10") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    // CANCELLED cash IS included in collectedCash (it's the total)
    expect(result.collectedCash).toBe(300000);
    // Subtotal tracks how much of that is from cancelled
    expect(result.collectedCashFromCancelledReservations).toBe(300000);
  });

  it("cancelled cash is subtotal within collectedCash — no balance or occupation", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CANCELLED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        unitsBooked: 2,
        payments: [
          makePayment({ amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-10") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.collectedCash).toBe(300000); // CANCELLED cash included
    expect(result.collectedCashFromCancelledReservations).toBe(300000);
    expect(result.outstandingBalance).toBe(0); // CANCELLED: no outstanding
    expect(result.occupiedNightUnits).toBe(0); // CANCELLED: no occupation
    expect(result.reservationCount).toBe(0); // CANCELLED doesn't count
  });

  it("mixed cancelled + active: both cash flows into collectedCash; cancelled subtotal tracked", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-cancelled",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CANCELLED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 200000,
        payments: [
          makePayment({ amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-05") }),
        ],
      }),
      makeReservation({
        id: "res-active",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-01-20"),
        totalPrice: 300000,
        unitsBooked: 1,
        payments: [
          makePayment({ amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-15") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    // collectedCash = active cash + cancelled cash (both in range)
    expect(result.collectedCash).toBe(300000); // 200k cancelled + 100k active
    expect(result.collectedCashFromCancelledReservations).toBe(200000); // subtotal
    // active reservation outstanding: 300k - 100k paid = 200k
    expect(result.outstandingBalance).toBe(200000);
    expect(result.reservationCount).toBe(1); // only active
  });

  it("cash is independent of reservation intersection — payment in range counts even if stay doesn't intersect", () => {
    // Reservation for Feb stay, but paid in January (early payment for future stay)
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-02-01"), // Feb stay — no intersection with Jan
        endDate: new Date("2026-02-10"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-15") }), // paid in Jan
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    // Cash counts because paidAt is in Jan range; stay intersection is irrelevant for cash
    expect(result.collectedCash).toBe(300000);
    expect(result.outstandingBalance).toBe(0); // 300k - 300k paid-to-date
    expect(result.reservationCount).toBe(0); // stays don't intersect Jan
  });
});

describe("buildDecisionSummary — outstandingBalance", () => {
  it("max(totalPrice - all completed RESERVATION payments, 0) for non-CANCELLED intersecting range", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-10") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.outstandingBalance).toBe(200000);
  });

  it("never negative (overpaid → 0)", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 500000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-10") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.outstandingBalance).toBe(0);
  });

  it("excludes CANCELLED reservations", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CANCELLED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-15"),
        totalPrice: 300000,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.outstandingBalance).toBe(0);
  });

  it("only counts reservations intersecting the stay range — date-only intersection", () => {
    // Feb 1-10 reservation: NO intersection with Jan 1-31 (date-only)
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-02-01"), // starts AFTER Jan ends — no intersection
        endDate: new Date("2026-02-10"),
        totalPrice: 300000,
        payments: [], // unpaid
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.outstandingBalance).toBe(0); // no intersection
    expect(result.reservationCount).toBe(0);
  });

  it("PARTIAL intersection still counts the full reservation for outstandingBalance", () => {
    // Reserve 10-20 Jan, range is 15-31 Jan → intersects, counts full outstanding
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-20"),
        totalPrice: 300000,
        payments: [], // unpaid
      }),
    ];

    const rangeStart = new Date("2026-01-15");
    const rangeEnd = new Date("2026-01-31");

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart,
      rangeEnd,
    });

    expect(result.outstandingBalance).toBe(300000); // full totalPrice, regardless of partial overlap
    expect(result.reservationCount).toBe(1);
  });

  it("snapshot current balance — uses ALL completed RESERVATION payments (paid-to-date), not limited to range", () => {
    // A reservation with partial payment made before the range
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-05"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-01") }), // paid before range
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    // Snapshot: 300k - 100k (all paid-to-date, not limited to range)
    expect(result.outstandingBalance).toBe(200000);
  });

  it("paid-to-date outside range: Jan range uses Nov payment for outstanding", () => {
    // Paid in Nov (outside Jan range), should still count for outstanding in Jan
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-05"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2025-11-15") }), // paid outside range
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    // Outstanding uses paid-to-date: 300k - 100k = 200k (Nov payment counts)
    expect(result.outstandingBalance).toBe(200000);
  });
});

describe("buildDecisionSummary — occupancy (occupiedNightUnits / capacityNightUnits / occupancyRate)", () => {
  it("inclusive intersection × unitsBooked", () => {
    // Reservation 15-20 Jan (6 nights), unitsBooked=2, range 18-25 Jan (8 days)
    // Intersection: 18,19,20 = 3 nights × 2 units = 6 occupiedNightUnits
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-01-20"),
        totalPrice: 300000,
        unitsBooked: 2,
        payments: [],
      }),
    ];

    const rangeStart = new Date("2026-01-18");
    const rangeEnd = new Date("2026-01-25");

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart,
      rangeEnd,
    });

    // 3 nights × 2 units = 6
    expect(result.occupiedNightUnits).toBe(6);
  });

  it("excludes CANCELLED from occupancy", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CANCELLED",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-01-20"),
        totalPrice: 300000,
        unitsBooked: 2,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.occupiedNightUnits).toBe(0);
  });

  it("capacityNightUnits = days_in_range × unitsAvailable — Jan 1-31 = 31 days", () => {
    // Date-only: Jan 1-31 = 31 calendar days
    // unitsAvailable = 5 → 31 × 5 = 155 capacity night-units
    const reservations: DecisionSummaryInput["reservations"] = [];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.capacityNightUnits).toBe(31 * 5); // 155
  });

  it("occupancyRate = occupiedNightUnits / capacityNightUnits", () => {
    // 6 occupied out of 155 (31 days × 5 units)
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-01-20"),
        totalPrice: 300000,
        unitsBooked: 2,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    // 6 nights × 2 units = 12 occupied; 31 days × 5 units = 155 capacity
    expect(result.occupiedNightUnits).toBe(12);
    expect(result.capacityNightUnits).toBe(31 * 5); // 155
    expect(result.occupancyRate).toBe(Math.round((12 / (31 * 5)) * 100));
  });

  it("capacity for property with zero reservations in range — shows 0% occupancy, capacity intact", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-01-20"),
        totalPrice: 300000,
        unitsBooked: 1,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [
        makeProperty("prop-1", "Edificio Centro", 5),
        makeProperty("prop-2", "Casa Playa", 3),
      ],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    const prop2Entry = result.byProperty.find((e) => e.propertyId === "prop-2")!;
    expect(prop2Entry.occupiedNightUnits).toBe(0);
    expect(prop2Entry.capacityNightUnits).toBe(31 * 3); // 93
    expect(prop2Entry.occupancyRate).toBe(0);
    expect(prop2Entry.activity).toBe("NONE");
  });
});

describe("buildDecisionSummary — reservationCount", () => {
  it("counts distinct non-CANCELLED reservation IDs intersecting range", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 100000,
        payments: [],
      }),
      makeReservation({
        id: "res-2",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-01-20"),
        totalPrice: 200000,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.reservationCount).toBe(2);
  });

  it("excludes CANCELLED", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CANCELLED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 100000,
        payments: [],
      }),
      makeReservation({
        id: "res-2",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-01-20"),
        totalPrice: 200000,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.reservationCount).toBe(1);
  });

  it("distinct count even with partial payments on same reservation", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-05") }),
          makePayment({ amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-06") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.reservationCount).toBe(1);
    expect(result.collectedCash).toBe(200000);
  });
});

describe("buildDecisionSummary — byBillingType", () => {
  it("groups DAILY and MONTHLY separately", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 300000,
        unitsBooked: 1,
        payments: [
          makePayment({ amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-05") }),
        ],
      }),
      makeReservation({
        id: "res-2",
        propertyId: "prop-1",
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        totalPrice: 500000,
        unitsBooked: 1,
        payments: [
          makePayment({ amount: 500000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-01") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.byBillingType.DAILY.collectedCash).toBe(300000);
    expect(result.byBillingType.MONTHLY.collectedCash).toBe(500000);
    expect(result.byBillingType.DAILY.reservationCount).toBe(1);
    expect(result.byBillingType.MONTHLY.reservationCount).toBe(1);
  });

  it("capacity per billing type = FULL scope capacity (all properties), not just those with that type", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 100000,
        unitsBooked: 1,
        payments: [],
      }),
      // prop-2 has no DAILY reservations — should still count in DAILY capacity denominator
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [
        makeProperty("prop-1", "Edificio Centro", 5),
        makeProperty("prop-2", "Casa Playa", 3),
      ],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    // DAILY capacity = all properties × days = (5+3) × 31 = 248
    expect(result.byBillingType.DAILY.capacityNightUnits).toBe((5 + 3) * 31);
  });
});

describe("buildDecisionSummary — byProperty", () => {
  it("includes ALL properties even with zero values (array, not Map)", () => {
    const reservations: DecisionSummaryInput["reservations"] = [];

    const result = buildDecisionSummary({
      reservations,
      properties: [
        makeProperty("prop-1", "Edificio Centro", 5),
        makeProperty("prop-2", "Casa Playa", 3),
        makeProperty("prop-3", "Depto Norte", 2),
      ],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.byProperty).toHaveLength(3);
    for (const entry of result.byProperty) {
      expect(entry.collectedCash).toBe(0);
      expect(entry.outstandingBalance).toBe(0);
      expect(entry.occupiedNightUnits).toBe(0);
      expect(entry.capacityNightUnits).toBeGreaterThan(0);
      expect(entry.activity).toBe("NONE");
    }
  });

  it("isolates metrics per property", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 300000,
        unitsBooked: 2,
        payments: [
          makePayment({ amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-05") }),
        ],
      }),
      makeReservation({
        id: "res-2",
        propertyId: "prop-2",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 100000,
        unitsBooked: 1,
        payments: [], // unpaid
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [
        makeProperty("prop-1", "Edificio Centro", 5),
        makeProperty("prop-2", "Casa Playa", 3),
      ],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    const prop1 = result.byProperty.find((e) => e.propertyId === "prop-1")!;
    const prop2 = result.byProperty.find((e) => e.propertyId === "prop-2")!;

    expect(prop1.collectedCash).toBe(300000);
    expect(prop1.outstandingBalance).toBe(0);
    expect(prop2.collectedCash).toBe(0);
    expect(prop2.outstandingBalance).toBe(100000);
  });
});

describe("buildDecisionSummary — activity", () => {
  it("NONE when no reservations", () => {
    const result = buildDecisionSummary({
      reservations: [],
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.activity).toBe("NONE");
  });

  it("DAILY when only DAILY reservations", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 100000,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.activity).toBe("DAILY");
  });

  it("MONTHLY when only MONTHLY reservations", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-31"),
        totalPrice: 500000,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.activity).toBe("MONTHLY");
  });

  it("MIXED when both DAILY and MONTHLY", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 100000,
        payments: [],
      }),
      makeReservation({
        id: "res-2",
        propertyId: "prop-1",
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-31"),
        totalPrice: 500000,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.activity).toBe("MIXED");
  });

  it("property with no active reservations → activity: NONE (not MIXED)", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CANCELLED", // cancelled — doesn't count as active
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 100000,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [
        makeProperty("prop-1", "Edificio Centro", 5),
        makeProperty("prop-2", "Casa Playa", 3),
      ],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    const prop1 = result.byProperty.find((e) => e.propertyId === "prop-1")!;
    const prop2 = result.byProperty.find((e) => e.propertyId === "prop-2")!;

    expect(prop1.activity).toBe("NONE"); // only had CANCELLED reservation
    expect(prop2.activity).toBe("NONE"); // had no reservations
  });
});

describe("buildDecisionSummary — EXTRA never enters", () => {
  it("collectedCash ignores EXTRA even if COMPLETED", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 300000,
        payments: [
          makePayment({ amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: new Date("2026-01-05") }),
          makePayment({ amount: 50000, status: "COMPLETED", paymentType: "EXTRA", paidAt: new Date("2026-01-05") }),
        ],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.collectedCash).toBe(300000);
    expect(result.outstandingBalance).toBe(0);
  });
});

describe("clipNightsToRange — date-only utility", () => {
  it("full intersection", () => {
    // reservation 10-15 Jan (6 nights), range 1-31 Jan → all 6 nights
    const nights = clipNightsToRange(
      new Date("2026-01-10"),
      new Date("2026-01-15"),
      new Date("2026-01-01"),
      new Date("2026-01-31"),
    );
    expect(nights).toBe(6); // 15-10+1 = 6
  });

  it("partial intersection (left clip)", () => {
    // reservation 1-20 Jan (20 nights), range 10-31 Jan → 11 nights
    const nights = clipNightsToRange(
      new Date("2026-01-01"),
      new Date("2026-01-20"),
      new Date("2026-01-10"),
      new Date("2026-01-31"),
    );
    expect(nights).toBe(11); // 20-10+1 = 11
  });

  it("partial intersection (right clip)", () => {
    // reservation 20-31 Jan, range 1-15 Jan → 0 nights (no intersection)
    const nights = clipNightsToRange(
      new Date("2026-01-20"),
      new Date("2026-01-31"),
      new Date("2026-01-01"),
      new Date("2026-01-15"),
    );
    expect(nights).toBe(0);
  });

  it("no intersection — Feb1-10 does NOT intersect Jan1-31 (date-only)", () => {
    const nights = clipNightsToRange(
      new Date("2026-02-01"),
      new Date("2026-02-10"),
      new Date("2026-01-01"),
      new Date("2026-01-31"),
    );
    expect(nights).toBe(0); // date-only: Feb1 > Jan31
  });

  it("boundary: reservation starts exactly on rangeEnd → 1 night (inclusive)", () => {
    // A reservation starting on rangeEnd counts that night
    const nights = clipNightsToRange(
      new Date("2026-01-31"),
      new Date("2026-02-05"),
      new Date("2026-01-01"),
      new Date("2026-01-31"),
    );
    expect(nights).toBe(1); // 31-31+1 = 1
  });
});

describe("getReservationPaidAmount — pure utility", () => {
  it("sums only COMPLETED RESERVATION non-deleted", () => {
    const payments = [
      makePayment({ amount: 100000, status: "COMPLETED", paymentType: "RESERVATION" }),
      makePayment({ amount: 50000, status: "COMPLETED", paymentType: "EXTRA" }),
      makePayment({ amount: 30000, status: "PENDING", paymentType: "RESERVATION" }),
      makePayment({ amount: 20000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: new Date() }),
    ];
    expect(getReservationPaidAmount(payments)).toBe(100000);
  });
});

describe("buildDecisionSummary — zero rows (empty property list)", () => {
  it("returns all zeros with empty arrays", () => {
    const result = buildDecisionSummary({
      reservations: [],
      properties: [],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.collectedCash).toBe(0);
    expect(result.collectedCashFromCancelledReservations).toBe(0);
    expect(result.outstandingBalance).toBe(0);
    expect(result.occupiedNightUnits).toBe(0);
    expect(result.capacityNightUnits).toBe(0);
    expect(result.occupancyRate).toBe(0);
    expect(result.reservationCount).toBe(0);
    expect(result.byProperty).toEqual([]);
    expect(result.activity).toBe("NONE");
  });
});

describe("buildDecisionSummary — integration with byBillingType DAILY/MONTHLY", () => {
  it("byBillingType reservationCount is distinct", () => {
    const reservations: DecisionSummaryInput["reservations"] = [
      makeReservation({
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-10"),
        totalPrice: 100000,
        payments: [],
      }),
      makeReservation({
        id: "res-2",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-01-20"),
        totalPrice: 200000,
        payments: [],
      }),
      makeReservation({
        id: "res-3",
        propertyId: "prop-1",
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        totalPrice: 500000,
        payments: [],
      }),
    ];

    const result = buildDecisionSummary({
      reservations,
      properties: [makeProperty("prop-1", "Edificio Centro", 5)],
      rangeStart: JAN_2026_START,
      rangeEnd: JAN_2026_END,
    });

    expect(result.byBillingType.DAILY.reservationCount).toBe(2);
    expect(result.byBillingType.MONTHLY.reservationCount).toBe(1);
    expect(result.reservationCount).toBe(3);
  });
});
