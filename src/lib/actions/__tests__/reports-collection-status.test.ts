import { describe, expect, it } from "vitest";

import {
  buildCollectionReportRows,
  getCollectionDueLabel,
  getCollectionStatus,
  type CollectionReportRow,
  type CollectionReservationInput,
} from "@/lib/reports/collection";

// Fijamos `now` al mediodía UTC del 15 de enero de 2026 para tener resultados
// deterministas independientemente de la zona horaria del runner.
const now = new Date("2026-01-15T12:00:00.000Z");

function makeRow(
  overrides: Partial<Pick<CollectionReportRow, "totalToCollect" | "overdue" | "nextDueDate">>,
): Pick<CollectionReportRow, "totalToCollect" | "overdue" | "nextDueDate"> {
  return {
    totalToCollect: 0,
    overdue: 0,
    nextDueDate: null,
    ...overrides,
  };
}

describe("getCollectionStatus", () => {
  it("devuelve Pagado (success) cuando totalToCollect es 0 aunque haya nextDueDate pasado", () => {
    const info = getCollectionStatus(
      makeRow({ totalToCollect: 0, overdue: 0, nextDueDate: new Date("2026-01-10") }),
      now,
    );
    expect(info.status).toBe("PAID");
    expect(info.label).toBe("Pagado");
    expect(info.variant).toBe("success");
  });

  it("devuelve Pagado incluso si overdue > 0 con totalToCollect = 0 (caso defensivo)", () => {
    const info = getCollectionStatus(
      makeRow({ totalToCollect: 0, overdue: 50000 }),
      now,
    );
    expect(info.status).toBe("PAID");
  });

  it("devuelve Vencido (destructive) cuando overdue > 0 aunque el próximo vencimiento sea hoy", () => {
    const info = getCollectionStatus(
      makeRow({
        totalToCollect: 200000,
        overdue: 100000,
        nextDueDate: new Date("2026-01-15T12:00:00.000Z"),
      }),
      now,
    );
    expect(info.status).toBe("OVERDUE");
    expect(info.variant).toBe("destructive");
  });

  it("devuelve Vence hoy (warning) cuando nextDueDate es el mismo día en Santiago", () => {
    // 15 ene 2026 23:00 UTC = 16 ene 2026 00:00 CLTS (con DST no aplica en enero).
    // Para asegurar mismo día en America/Santiago usamos mediodía UTC del mismo día.
    const info = getCollectionStatus(
      makeRow({
        totalToCollect: 100000,
        overdue: 0,
        nextDueDate: new Date("2026-01-15T15:00:00.000Z"),
      }),
      now,
    );
    expect(info.status).toBe("DUE_TODAY");
    expect(info.label).toBe("Vence hoy");
    expect(info.variant).toBe("warning");
  });

  it("devuelve Próximo (info) cuando nextDueDate está dentro de 1 a 7 días", () => {
    const info = getCollectionStatus(
      makeRow({
        totalToCollect: 100000,
        overdue: 0,
        nextDueDate: new Date("2026-01-18T15:00:00.000Z"), // +3 días
      }),
      now,
    );
    expect(info.status).toBe("UPCOMING");
    expect(info.label).toBe("Próximo");
    expect(info.variant).toBe("info");
  });

  it("devuelve Próximo a 7 días exactos (boundary)", () => {
    const info = getCollectionStatus(
      makeRow({
        totalToCollect: 100000,
        overdue: 0,
        nextDueDate: new Date("2026-01-22T15:00:00.000Z"), // +7 días
      }),
      now,
    );
    expect(info.status).toBe("UPCOMING");
  });

  it("devuelve Pendiente (warning) cuando nextDueDate está a más de 7 días", () => {
    const info = getCollectionStatus(
      makeRow({
        totalToCollect: 100000,
        overdue: 0,
        nextDueDate: new Date("2026-02-15T15:00:00.000Z"), // +31 días
      }),
      now,
    );
    expect(info.status).toBe("PENDING");
    expect(info.label).toBe("Pendiente");
    expect(info.variant).toBe("warning");
  });

  it("devuelve Pendiente (fallback) cuando hay deuda pero no hay nextDueDate", () => {
    const info = getCollectionStatus(
      makeRow({ totalToCollect: 100000, overdue: 0, nextDueDate: null }),
      now,
    );
    expect(info.status).toBe("PENDING");
  });
});

describe("getCollectionDueLabel", () => {
  it("devuelve '—' cuando no hay nextDueDate", () => {
    expect(getCollectionDueLabel(null, now)).toBe("—");
  });

  it("devuelve 'Hoy' para el día actual", () => {
    expect(getCollectionDueLabel(new Date("2026-01-15T15:00:00.000Z"), now)).toBe("Hoy");
  });

  it("devuelve 'Mañana' para el día siguiente", () => {
    expect(getCollectionDueLabel(new Date("2026-01-16T15:00:00.000Z"), now)).toBe("Mañana");
  });

  it("devuelve 'En N días' para 2..7 días", () => {
    expect(getCollectionDueLabel(new Date("2026-01-17T15:00:00.000Z"), now)).toBe("En 2 días");
    expect(getCollectionDueLabel(new Date("2026-01-22T15:00:00.000Z"), now)).toBe("En 7 días");
  });

  it("omite el año cuando es el mismo año y lo incluye cuando cambia", () => {
    // Mismo año
    const sameYear = getCollectionDueLabel(new Date("2026-02-15T15:00:00.000Z"), now);
    expect(sameYear).toMatch(/15/);
    expect(sameYear).toMatch(/feb/i);
    expect(sameYear).not.toMatch(/2026/);

    // Otro año
    const otherYear = getCollectionDueLabel(new Date("2027-02-15T15:00:00.000Z"), now);
    expect(otherYear).toMatch(/2027/);
  });
});

describe("getCollectionStatus — integración con buildCollectionReportRows", () => {
  it("clasifica correctamente una reserva monthly con varias cuotas", () => {
    const reservation: CollectionReservationInput = {
      id: "res-1",
      propertyId: "prop-1",
      propertyName: "Edificio Centro",
      clientId: "cli-1",
      clientName: "Ana Perez",
      billingType: "MONTHLY",
      status: "CONFIRMED",
      startDate: new Date("2025-12-01T00:00:00.000Z"),
      totalPrice: 300000,
      payments: [
        // 1ra cuota vencida (5 días atrás)
        {
          amount: 100000,
          status: "PENDING",
          paymentType: "RESERVATION",
          deletedAt: null,
          dueDate: new Date("2026-01-10T00:00:00.000Z"),
        },
        // 2da cuota en 3 días
        {
          amount: 100000,
          status: "PENDING",
          paymentType: "RESERVATION",
          deletedAt: null,
          dueDate: new Date("2026-01-18T00:00:00.000Z"),
        },
        // 3ra cuota en 35 días
        {
          amount: 100000,
          status: "PENDING",
          paymentType: "RESERVATION",
          deletedAt: null,
          dueDate: new Date("2026-02-19T00:00:00.000Z"),
        },
      ],
    };

    const [row] = buildCollectionReportRows([reservation], { now, debtStatus: "ALL" });
    expect(row).toBeDefined();
    const status = getCollectionStatus(row, now);

    // Hay overdue → Vencido prevalece sobre "Próximo"
    expect(status.status).toBe("OVERDUE");
  });
});
