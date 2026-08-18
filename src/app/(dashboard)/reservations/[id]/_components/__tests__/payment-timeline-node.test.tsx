import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PaymentTimelineNode } from "../payment-timeline-node";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockPayment = (overrides = {}) => ({
  id: "pay-1",
  installmentIndex: 1,
  amount: "50000",
  dueDate: "2025-01-15T00:00:00Z",
  status: "COMPLETED",
  method: "MERCADO_PAGO",
  initPoint: null,
  expiresAt: null,
  paidAt: "2025-01-10T10:00:00Z",
  deletedAt: null,
  receiptUrl: null,
  paymentType: "RESERVATION",
  title: null,
  description: null,
  installmentLabel: null,
  ...overrides,
});

describe("PaymentTimelineNode", () => {
  describe("installment number rendering", () => {
    it("renders installment number inside eyebrow with correct typography classes", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ installmentIndex: 3 })}
          index={2} total={6} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      const eyebrow = screen.getByText(/Mensualidad · Cuota 3 de 6/);
      expect(eyebrow).toBeTruthy();
      expect(eyebrow.className).toContain("text-[10px]");
      expect(eyebrow.className).toContain("font-bold");
      expect(eyebrow.className).toContain("uppercase");
    });
    it("uses index+1 when installmentIndex is null", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ installmentIndex: null })}
          index={4} total={6} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      expect(screen.getByText(/Mensualidad · Cuota 5 de 6/)).toBeTruthy();
    });
  });

  describe("tonal bar color by status", () => {
    it("COMPLETED payment uses success bar", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "COMPLETED" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      const dot = document.querySelector("[class*=\"bg-success\"]");
      expect(dot).toBeTruthy();
    });
    it("PENDING overdue uses destructive bar", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={-5} isActive={true}
        />
      );
      const dot = document.querySelector("[class*=\"bg-destructive\"]");
      expect(dot).toBeTruthy();
    });
    it("PENDING due today uses warning bar", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={0} isActive={true}
        />
      );
      const dot = document.querySelector("[class*=\"bg-warning\"]");
      expect(dot).toBeTruthy();
    });
    it("PENDING upcoming within 7 days uses info bar", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={5} isActive={true}
        />
      );
      const dot = document.querySelector("[class*=\"bg-info\"]");
      expect(dot).toBeTruthy();
    });
    it("PENDING far future uses info bar", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={30} isActive={true}
        />
      );
      const dot = document.querySelector("[class*=\"bg-info\"]");
      expect(dot).toBeTruthy();
    });
  });

  describe("vertical connector", () => {
    it("renders connector between nodes when not last", () => {
      const { container } = render(
        <PaymentTimelineNode
          payment={mockPayment()}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      const connector = container.querySelector("[class*=\"bg-foreground/10\"]");
      expect(connector).toBeTruthy();
    });
    it("connector has aria-hidden=true", () => {
      const { container } = render(
        <PaymentTimelineNode
          payment={mockPayment()}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      const connector = container.querySelector("[aria-hidden=\"true\"]");
      expect(connector).toBeTruthy();
    });
    it("does not render connector on last node", () => {
      const { container } = render(
        <PaymentTimelineNode
          payment={mockPayment()}
          index={2} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      const connectors = container.querySelectorAll("[class*=\"bg-foreground/10\"]");
      expect(connectors.length).toBe(0);
    });
  });

  describe("contextual primary action", () => {
    it("COMPLETED with receiptUrl shows Ver comprobante ghost", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "COMPLETED", receiptUrl: "https://example.com/receipt.pdf" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      expect(screen.getByRole("button", { name: /ver comprobante/i })).toBeTruthy();
    });
    it("COMPLETED without receiptUrl shows Ver comprobante disabled", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "COMPLETED", receiptUrl: null })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      const btn = screen.getByRole("button", { name: /ver comprobante/i }) as HTMLButtonElement;
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(true);
    });
    it("PENDING MERCADO_PAGO without initPoint shows Enviar link", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING", method: "MERCADO_PAGO", initPoint: null })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={3} isActive={true}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /enviar link/i })).toBeTruthy();
    });
    it("PENDING MERCADO_PAGO with valid initPoint shows Enviar link", () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING", method: "MERCADO_PAGO", initPoint: "https://mp.com/link", expiresAt: tomorrow.toISOString() })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={3} isActive={true}
          onSendLink={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /enviar link/i })).toBeTruthy();
    });
    it("PENDING overdue shows Marcar pagado destructive", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={-5} isActive={true}
          onMarkPaid={vi.fn()}
        />
      );
      // The component renders "Marcar pagado" (without "como") for timeline node
      expect(screen.getByRole("button", { name: /marcar pagado/i })).toBeTruthy();
    });
  });

  describe("overdue indicator", () => {
    it("shows Vencido label on overdue pending payments", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={-3} isActive={true}
        />
      );
      expect(screen.getByText("Vencido")).toBeTruthy();
    });
    it("does not show Vencido on non-overdue payments", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={5} isActive={true}
        />
      );
      expect(screen.queryByText("Vencido")).toBeNull();
    });
  });

  describe("isFirstOverdue ring", () => {
    it("adds ring-2 class when isFirstOverdue=true", () => {
      const { container } = render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={-3} isActive={true}
          isFirstOverdue={true}
        />
      );
      const ring = container.querySelector("[class*=\"ring-2\"]");
      expect(ring).toBeTruthy();
    });
  });

  describe("amount and due date", () => {
    it("renders formatted amount", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ amount: "250000" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      expect(screen.getByText("$250.000")).toBeTruthy();
    });
    it("renders due date label", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ dueDate: "2025-01-20T00:00:00Z" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      expect(screen.getByText(/vence/i)).toBeTruthy();
    });
  });

  describe("FAILED payment actions", () => {
    it("does not render primary action buttons for FAILED payments", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "FAILED", method: "MERCADO_PAGO", initPoint: null })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
          onGenerateLink={vi.fn()}
          onMarkPaid={vi.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /generar link/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /marcar pagado/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /enviar link/i })).toBeNull();
    });
    it("does not render dropdown for FAILED payments", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "FAILED", method: "MERCADO_PAGO" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
          onGenerateLink={vi.fn()}
          onDeletePayment={vi.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /m\u00e1s acciones/i })).toBeNull();
    });
  });
});
