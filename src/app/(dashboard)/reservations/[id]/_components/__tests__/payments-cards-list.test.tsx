import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentsCardsList } from "../payments-cards-list";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockPayment = (overrides = {}) => ({
  id: "pay-1",
  installmentIndex: null,
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
  title: null,
  description: null,
  installmentLabel: null,
  ...overrides,
});

describe("PaymentsCardsList", () => {
  describe("celebratory state", () => {
    it("renders compact strip with payment count and total when all COMPLETED", () => {
      render(
        <PaymentsCardsList
          payments={[
            mockPayment({ id: "p1", status: "COMPLETED", amount: "50000" }),
            mockPayment({ id: "p2", status: "COMPLETED", amount: "50000" }),
          ]}
          nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByText("2 pagos · $100.000 cobrados")).toBeTruthy();
    });
    it("renders single payment copy when only one payment", () => {
      render(
        <PaymentsCardsList
          payments={[
            mockPayment({ id: "p1", status: "COMPLETED", amount: "175000" }),
          ]}
          nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByText("Pago cobrado · $175.000")).toBeTruthy();
    });
    it("does not render celebratory when there is a PENDING payment", () => {
      render(
        <PaymentsCardsList
          payments={[
            mockPayment({ id: "p1", status: "COMPLETED" }),
            mockPayment({ id: "p2", status: "PENDING" }),
          ]}
          nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.queryByText(/pagos \u00b7/)).toBeNull();
      expect(screen.queryByText(/pago cobrado/i)).toBeNull();
    });
    it("does not render celebratory when payments array is empty", () => {
      render(
        <PaymentsCardsList
          payments={[]}
          nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.queryByText(/pagos \u00b7/)).toBeNull();
      expect(screen.queryByText(/pago cobrado/i)).toBeNull();
    });
  });

  describe("variant prop", () => {
    it("variant=extra uses extra celebratory copy", () => {
      render(
        <PaymentsCardsList
          payments={[
            mockPayment({ id: "e1", status: "COMPLETED", amount: "30000" }),
            mockPayment({ id: "e2", status: "COMPLETED", amount: "40000" }),
          ]}
          nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()}
          variant="extra"
        />
      );
      expect(screen.getByText("2 pagos · $70.000 cobrados")).toBeTruthy();
    });
    it("variant=extra uses extra empty state message", () => {
      render(
        <PaymentsCardsList
          payments={[]}
          nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()}
          variant="extra"
        />
      );
      expect(screen.getByText("Aún no hay cobros extra registrados")).toBeTruthy();
    });
  });

  describe("empty state", () => {
    it("renders empty state with message when payments is empty and isActive=true", () => {
      render(
        <PaymentsCardsList
          payments={[]} nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()} onAddPayment={vi.fn()}
        />
      );
      expect(screen.getByText("Aún no hay pagos registrados")).toBeTruthy();
    });
    it("renders empty state with CTA when isActive=true", () => {
      render(
        <PaymentsCardsList
          payments={[]} nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()} onAddPayment={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /agregar pago/i })).toBeTruthy();
    });
    it("renders inactive empty state when isActive=false", () => {
      render(
        <PaymentsCardsList
          payments={[]} nowKey="2025-01-01" isActive={false}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByText("Esta reserva no tiene pagos registrados.")).toBeTruthy();
    });
    it("does not render CTA in inactive empty state", () => {
      render(
        <PaymentsCardsList
          payments={[]} nowKey="2025-01-01" isActive={false}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /agregar pago/i })).toBeNull();
    });
  });

  describe("payment cards rendering", () => {
    it("renders one PaymentCard per payment", () => {
      render(
        <PaymentsCardsList
          payments={[
            mockPayment({ id: "p1", amount: "10000" }),
            mockPayment({ id: "p2", amount: "20000" }),
            mockPayment({ id: "p3", amount: "30000" }),
          ]}
          nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()}
        />
      );
      const cards = document.querySelectorAll("[data-testid^=\"payment-card-\"]");
      expect(cards.length).toBe(3);
    });
  });
});