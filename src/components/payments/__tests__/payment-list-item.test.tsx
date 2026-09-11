import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Payment } from "../payments-table";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { PaymentListItem } from "../payment-list-item";

const createMockPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: "payment-1",
  installmentIndex: undefined,
  amount: "50000",
  dueDate: null,
  status: "COMPLETED",
  method: "MERCADO_PAGO",
  initPoint: null,
  expiresAt: null,
  paidAt: "2025-01-15T10:00:00Z",
  deletedAt: null,
  receiptUrl: null,
  paymentType: "RESERVATION",
  createdAt: "2025-07-15T10:00:00Z",
  clientName: "Carlos Rodríguez",
  propertyName: "Cabaña del Bosque",
  ...overrides,
});

describe("PaymentListItem", () => {
  it("muestra los cinco datos que la tabla reparte en columnas", () => {
    // Cliente, propiedad, concepto, monto y estado. En la tabla cada uno tiene
    // su columna; acá van apilados en una fila de ~184px.
    const payment = createMockPayment({ amount: "450000", method: "CASH" });

    render(<PaymentListItem payment={payment} />);

    expect(screen.getByText("Carlos Rodríguez")).toBeTruthy();
    expect(screen.getByText("Cabaña del Bosque")).toBeTruthy();
    expect(screen.getByText("Diario")).toBeTruthy();
    expect(screen.getByText("$450.000")).toBeTruthy();
    expect(screen.getByText("Pagado")).toBeTruthy();
  });

  it("nombra la magnitud del monto, porque una lista no tiene encabezado", () => {
    // En la tabla el nombre lo pone el `<th>`. Sin este label el monto queda
    // como una cifra suelta sin decir de qué.
    render(<PaymentListItem payment={createMockPayment()} />);

    expect(screen.getByText("Monto")).toBeTruthy();
  });

  it("combina medio de pago y cuota en una línea", () => {
    const payment = createMockPayment({
      method: "MERCADO_PAGO",
      installmentIndex: 3,
      installmentLabel: "3 / 12",
    });

    render(<PaymentListItem payment={payment} />);

    expect(screen.getByText("Mercado Pago · Cuota 3 / 12")).toBeTruthy();
  });

  it("omite la cuota cuando el pago no es una", () => {
    const payment = createMockPayment({
      method: "TRANSFER",
      installmentIndex: null,
      installmentLabel: null,
      description: null,
    });

    render(<PaymentListItem payment={payment} />);

    expect(screen.getByText("Transferencia")).toBeTruthy();
  });

  it("muestra la mora coloreada", () => {
    const payment = createMockPayment({
      status: "PENDING",
      paidAt: null,
      overdueDays: 12,
    });

    render(<PaymentListItem payment={payment} />);

    const linea = screen.getByText("Vencido hace 12 días");
    expect(linea.className).toContain("text-destructive-text");
  });

  it("marca el link de Mercado Pago expirado", () => {
    const payment = createMockPayment({
      status: "PENDING",
      paidAt: null,
      method: "MERCADO_PAGO",
      initPoint: "https://mp/x",
      expiresAt: "2020-01-01T00:00:00Z",
    });

    render(<PaymentListItem payment={payment} />);

    expect(screen.getByText("Expirado")).toBeTruthy();
  });

  it("expone las acciones del pago, que en la tabla vivían tras scroll", () => {
    const onMarkPaid = vi.fn();
    const payment = createMockPayment({ status: "PENDING", paidAt: null, method: "CASH" });

    render(<PaymentListItem payment={payment} onMarkPaid={onMarkPaid} />);

    expect(screen.getByRole("button", { name: /marcar como pagado/i })).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Concepto y salida a la reserva
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentListItem - concepto y reserva", () => {
  it("un cobro extra lleva los dos badges", () => {
    render(
      <PaymentListItem
        payment={createMockPayment({
          paymentType: "EXTRA",
          billingType: "MONTHLY",
          title: "Multa por daños",
        })}
      />,
    );

    expect(screen.getByText("Mensual")).toBeTruthy();
    expect(screen.getByText("Extra")).toBeTruthy();
  });

  it("ofrece ir a la reserva del cobro", () => {
    // Hasta acá, desde un pago no había forma de llegar a su reserva.
    render(
      <PaymentListItem payment={createMockPayment({ reservationId: "res-7" })} />,
    );

    const enlace = screen.getByRole("link", { name: /ver reserva/i });
    expect(enlace.getAttribute("href")).toBe("/reservations/res-7");
  });

  it("sin reserva conocida no ofrece el enlace", () => {
    render(<PaymentListItem payment={createMockPayment({ reservationId: null })} />);

    expect(screen.queryByRole("link", { name: /ver reserva/i })).toBeNull();
  });
});
