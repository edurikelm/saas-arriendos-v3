import { describe, expect, it } from "vitest";
import { classifyCollectionAlerts, type CollectionAlertPayment } from "@/lib/alerts/collection-alerts";

function buildPayment(overrides: Partial<CollectionAlertPayment> = {}): CollectionAlertPayment {
  return {
    id: "pay-1",
    status: "PENDING",
    paymentType: "RESERVATION",
    method: "MERCADO_PAGO",
    dueDate: "2026-05-20T16:00:00.000Z",
    initPoint: null,
    expiresAt: null,
    reservation: {
      id: "res-1",
      status: "CONFIRMED",
      client: { name: "Juan Perez" },
      property: { name: "Depto Centro" },
    },
    ...overrides,
  };
}

describe("classifyCollectionAlerts", () => {
  it("clasifica en vencidos, vencen hoy y proximos 7 dias", () => {
    const now = new Date("2026-05-20T16:00:00.000Z");
    const payments = [
      buildPayment({ id: "old", dueDate: "2026-05-19T16:00:00.000Z" }),
      buildPayment({ id: "today", dueDate: "2026-05-20T16:00:00.000Z" }),
      buildPayment({ id: "next", dueDate: "2026-05-27T12:00:00.000Z" }),
      buildPayment({ id: "outside", dueDate: "2026-05-28T12:00:00.000Z" }),
    ];

    const result = classifyCollectionAlerts(payments, now);

    expect(result.vencidos.map((p) => p.paymentId)).toEqual(["old"]);
    expect(result.vencenHoy.map((p) => p.paymentId)).toEqual(["today"]);
    expect(result.proximos7Dias.map((p) => p.paymentId)).toEqual(["next"]);
  });

  it("filtra pagos que no cumplen reglas de negocio", () => {
    const now = new Date("2026-05-20T16:00:00.000Z");
    const payments = [
      buildPayment({ id: "ok" }),
      buildPayment({ id: "completed", status: "COMPLETED" }),
      buildPayment({ id: "extra", paymentType: "EXTRA" }),
      buildPayment({ id: "cancelled-res", reservation: { id: "r2", status: "CANCELLED", client: { name: "A" }, property: { name: "B" } } }),
      buildPayment({ id: "completed-res", reservation: { id: "r3", status: "COMPLETED", client: { name: "A" }, property: { name: "B" } } }),
      buildPayment({ id: "no-due", dueDate: null }),
    ];

    const result = classifyCollectionAlerts(payments, now);

    expect(result.vencenHoy.map((p) => p.paymentId)).toEqual(["ok"]);
    expect(result.vencidos).toHaveLength(0);
    expect(result.proximos7Dias).toHaveLength(0);
  });

  it("respeta zona horaria America/Santiago en el corte del dia", () => {
    const now = new Date("2026-05-20T03:30:00.000Z");
    const payment = buildPayment({ id: "scl-today", dueDate: "2026-05-20T03:00:00.000Z" });

    const result = classifyCollectionAlerts([payment], now);

    expect(result.vencenHoy.map((p) => p.paymentId)).toEqual(["scl-today"]);
  });
});
