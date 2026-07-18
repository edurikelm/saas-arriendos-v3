import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { PaymentReceipt } from "../receipt-pdf";

// Mock renderToBuffer BEFORE any imports from @react-pdf/renderer
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 mock")),
  StyleSheet: { create: vi.fn(() => ({})) },
  Document: ({ children }: { children: React.ReactNode }) => children,
  Page: ({ children }: { children: React.ReactNode }) => children,
  View: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
}));

// Fixtures — match PaymentReceiptData shape (no address field on property)
const PAID_AT = new Date("2025-06-15T12:00:00Z");
const PAID_AT_UNIX = Math.floor(PAID_AT.getTime() / 1000); // 1750000800

const basePayment = {
  id: "pay-test-1",
  amount: 50000,
  paidAt: PAID_AT,
  method: "MERCADO_PAGO",
  mpPaymentId: "mp-123456",
  mpStatusDetail: "accredited",
  mpPaymentMethodId: "credit_card",
  mpPaymentType: "credit_card",
  mpCardLastFour: "1234",
  mpInstallments: 1,
  mpTransactionAmount: 50000,
  mpNetReceivedAmount: 47500,
  mpFeeAmount: 2500,
  mpDateCreated: PAID_AT,
  reservation: {
    id: "res-test-1",
    startDate: new Date("2025-06-01"),
    endDate: new Date("2025-06-05"),
    billingType: "DAILY" as const,
    totalPrice: 200000,
    client: { id: "c1", name: "Juan Pérez", email: "juan@test.com", phone: "+56912345678" },
    property: { id: "p1", name: "Cabaña del Bosque" },
  },
};

describe("PaymentReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(renderToBuffer).mockResolvedValue(Buffer.from("%PDF-1.4 mock"));
  });

  it("calls renderToBuffer when rendering a DAILY reservation", async () => {
    await renderToBuffer(
      <PaymentReceipt payment={basePayment} paidAtUnix={PAID_AT_UNIX} />
    );

    expect(renderToBuffer).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(renderToBuffer).mock.calls[0][0];
    expect(callArg.props.payment.reservation.billingType).toBe("DAILY");
  });

  it("calls renderToBuffer for a MONTHLY reservation", async () => {
    const paymentMonthly = {
      ...basePayment,
      reservation: {
        ...basePayment.reservation,
        billingType: "MONTHLY" as const,
        startDate: new Date("2025-09-01"),
        endDate: new Date("2025-09-30"),
      },
    };

    await renderToBuffer(
      <PaymentReceipt payment={paymentMonthly} paidAtUnix={PAID_AT_UNIX} />
    );

    expect(renderToBuffer).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(renderToBuffer).mock.calls[0][0];
    expect(callArg.props.payment.reservation.billingType).toBe("MONTHLY");
  });

  it("handles missing MP optional fields without crashing", async () => {
    const paymentNoMp = {
      ...basePayment,
      mpPaymentId: null,
      mpStatusDetail: null,
      mpPaymentMethodId: null,
      mpPaymentType: null,
      mpCardLastFour: null,
      mpInstallments: null,
      mpTransactionAmount: null,
      mpNetReceivedAmount: null,
      mpFeeAmount: null,
      mpDateCreated: null,
    };

    // Should not throw
    await renderToBuffer(
      <PaymentReceipt payment={paymentNoMp} paidAtUnix={PAID_AT_UNIX} />
    );

    expect(renderToBuffer).toHaveBeenCalledTimes(1);
  });

  it("handles non-MP method (CASH) without MP fields", async () => {
    const paymentCash = {
      ...basePayment,
      method: "CASH" as const,
      mpPaymentId: null,
      mpStatusDetail: null,
      mpPaymentMethodId: null,
      mpPaymentType: null,
      mpCardLastFour: null,
      mpInstallments: null,
      mpTransactionAmount: null,
      mpNetReceivedAmount: null,
      mpFeeAmount: null,
      mpDateCreated: null,
    };

    // Should not throw
    await renderToBuffer(
      <PaymentReceipt payment={paymentCash} paidAtUnix={PAID_AT_UNIX} />
    );

    expect(renderToBuffer).toHaveBeenCalledTimes(1);
  });
});
