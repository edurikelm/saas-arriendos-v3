import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PaymentCard } from "../payment-card";

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

describe("PaymentCard", () => {
  describe("render", () => {
    it("renders amount formatted as CLP currency", () => {
      render(<PaymentCard payment={mockPayment({ amount: "150000" })} index={0} total={3} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("$150.000")).toBeTruthy();
    });
    it("renders PENDING badge", () => {
      render(<PaymentCard payment={mockPayment({ status: "PENDING" })} index={0} total={3} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("Pendiente")).toBeTruthy();
    });
    it("renders COMPLETED badge", () => {
      render(<PaymentCard payment={mockPayment({ status: "COMPLETED" })} index={0} total={3} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("Pagado")).toBeTruthy();
    });
    it("renders FAILED badge", () => {
      render(<PaymentCard payment={mockPayment({ status: "FAILED" })} index={0} total={3} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("Fallido")).toBeTruthy();
    });
    it("renders Mercado Pago method", () => {
      render(<PaymentCard payment={mockPayment({ method: "MERCADO_PAGO" })} index={0} total={3} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("Mercado Pago")).toBeTruthy();
    });
    it("renders CASH method", () => {
      render(<PaymentCard payment={mockPayment({ method: "CASH" })} index={0} total={3} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("Efectivo")).toBeTruthy();
    });
    it("renders TRANSFER method", () => {
      render(<PaymentCard payment={mockPayment({ method: "TRANSFER" })} index={0} total={3} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("Transferencia")).toBeTruthy();
    });
    it("renders installment context for monthly payments", () => {
      render(<PaymentCard payment={mockPayment({ installmentIndex: 3 })} index={2} total={6} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("Cuota 3")).toBeTruthy();
    });
    it("renders payment N/total context for daily payments", () => {
      render(<PaymentCard payment={mockPayment({ installmentIndex: null })} index={1} total={4} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("Pago 2 de 4")).toBeTruthy();
    });
    it("renders installmentLabel directly without prepended cuota", () => {
      render(<PaymentCard payment={mockPayment({ installmentLabel: "Cuota 1 - Sep" })} index={0} total={3} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("Cuota 1 - Sep")).toBeTruthy();
    });
  });

  describe("dropdown actions", () => {
    it("opens dropdown on MoreHorizontal button for PENDING CASH", async () => {
      const onDelete = vi.fn();
      const onMarkPaid = vi.fn();
      render(
        <PaymentCard
          payment={mockPayment({ id: "pay-1", status: "PENDING", method: "CASH" })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onDeletePayment={onDelete} onMarkPaid={onMarkPaid}
        />
      );
      const trigger = screen.getByRole("button", { name: /m\u00e1s acciones/i });
      await act(async () => { trigger.click(); });
      expect(screen.getByText("Eliminar pago")).toBeTruthy();
    });
    it("does not render dropdown when no actions available", () => {
      render(
        <PaymentCard
          payment={mockPayment({ status: "COMPLETED", method: "CASH", receiptUrl: null })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
        />
      );
      expect(screen.queryByRole("button", { name: /m\u00e1s acciones/i })).toBeNull();
    });
  });

  describe("primary CTA per status", () => {
    it("COMPLETED with receiptUrl shows Ver comprobante ghost", () => {
      render(
        <PaymentCard
          payment={mockPayment({ status: "COMPLETED", receiptUrl: "https://example.com/receipt.pdf" })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
        />
      );
      expect(screen.getByRole("button", { name: /ver comprobante/i })).toBeTruthy();
    });
    it("COMPLETED without receiptUrl shows Ver comprobante disabled", () => {
      render(
        <PaymentCard
          payment={mockPayment({ status: "COMPLETED", receiptUrl: null })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
        />
      );
      const btn = screen.getByRole("button", { name: /ver comprobante/i }) as HTMLButtonElement;
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(true);
    });
    it("PENDING MERCADO_PAGO without initPoint shows Generar link", () => {
      render(
        <PaymentCard
          payment={mockPayment({ status: "PENDING", method: "MERCADO_PAGO", initPoint: null })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /generar link/i })).toBeTruthy();
    });
    it("PENDING MERCADO_PAGO expired shows Regenerar link", () => {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      render(
        <PaymentCard
          payment={mockPayment({ status: "PENDING", method: "MERCADO_PAGO", initPoint: "https://mp.com/sandbox", expiresAt: yesterday.toISOString() })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onRegenerateLink={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /regenerar link/i })).toBeTruthy();
    });
    it("PENDING CASH without link shows Marcar pagado destructive", () => {
      render(
        <PaymentCard
          payment={mockPayment({ status: "PENDING", method: "CASH", initPoint: null })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onMarkPaid={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /marcar pagado/i })).toBeTruthy();
    });
    it("PENDING MERCADO_PAGO with valid initPoint shows Marcar pagado", () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      render(
        <PaymentCard
          payment={mockPayment({ status: "PENDING", method: "MERCADO_PAGO", initPoint: "https://mp.com/link", expiresAt: tomorrow.toISOString() })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onMarkPaid={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /marcar pagado/i })).toBeTruthy();
    });
  });

  describe("isActive gating", () => {
    it("renders with muted opacity when inactive", () => {
      const { container } = render(
        <PaymentCard payment={mockPayment({ status: "COMPLETED" })} index={0} total={3} nowKey="2025-01-01" isActive={false} />
      );
      const article = container.querySelector("article");
      expect(article?.className).toContain("opacity-60");
    });
  });

  describe("due date", () => {
    it("renders due date when set", () => {
      render(
        <PaymentCard payment={mockPayment({ dueDate: "2025-01-20T00:00:00Z" })} index={0} total={3} nowKey="2025-01-01" isActive={true} />
      );
      expect(screen.getByText(/vence/i)).toBeTruthy();
    });
  });

  describe("FAILED payment actions", () => {
    it("does not render primary action buttons for FAILED payments", () => {
      render(
        <PaymentCard
          payment={mockPayment({ status: "FAILED", method: "MERCADO_PAGO", initPoint: null })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onGenerateLink={vi.fn()}
          onMarkPaid={vi.fn()}
          onDeletePayment={vi.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /generar link/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /marcar pagado/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /eliminar/i })).toBeNull();
    });
    it("does not render dropdown for FAILED payments", () => {
      render(
        <PaymentCard
          payment={mockPayment({ status: "FAILED", method: "CASH" })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onDeletePayment={vi.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /m\u00e1s acciones/i })).toBeNull();
    });
  });
});
