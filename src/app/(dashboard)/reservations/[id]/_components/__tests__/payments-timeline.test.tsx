import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentsTimeline } from "../payments-timeline";

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

describe("PaymentsTimeline", () => {
  describe("focus card for overdue", () => {
    it("renders focus card when overdueCount > 0", () => {
      render(
        <PaymentsTimeline
          payments={[
            mockPayment({ id: "p1", status: "COMPLETED" }),
            mockPayment({ id: "p2", status: "PENDING" }),
          ]}
          isActive={true} overdueCount={1} overdueAmount={50000}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByText("Tienes 1 cuota vencida · $50.000")).toBeTruthy();
    });
    it("uses plural for multiple overdue", () => {
      render(
        <PaymentsTimeline
          payments={[
            mockPayment({ id: "p1", status: "PENDING" }),
            mockPayment({ id: "p2", status: "PENDING" }),
          ]}
          isActive={true} overdueCount={2} overdueAmount={100000}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByText("Tienes 2 cuotas vencidas · $100.000")).toBeTruthy();
    });
    it("does not render focus card when overdueCount is 0", () => {
      render(
        <PaymentsTimeline
          payments={[
            mockPayment({ id: "p1", status: "COMPLETED" }),
            mockPayment({ id: "p2", status: "PENDING" }),
          ]}
          isActive={true} overdueCount={0} overdueAmount={0}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.queryByText(/tienes.*cuota.*vencida/i)).toBeNull();
    });
    it("focus card CTA has Ir a la primera cuota vencida label", () => {
      render(
        <PaymentsTimeline
          payments={[
            mockPayment({ id: "p1", status: "COMPLETED" }),
            mockPayment({ id: "p2", status: "PENDING" }),
          ]}
          isActive={true} overdueCount={1} overdueAmount={50000}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /ir a la primera cuota vencida/i })).toBeTruthy();
    });
  });

  describe("no focus card in normal state", () => {
    it("no focus card when no overdue payments", () => {
      render(
        <PaymentsTimeline
          payments={[
            mockPayment({ id: "p1", status: "COMPLETED" }),
            mockPayment({ id: "p2", status: "PENDING" }),
          ]}
          isActive={true} overdueCount={0} overdueAmount={0}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.queryByText(/tienes.*cuota.*vencida/i)).toBeNull();
    });
  });

  describe("celebratory strip (removed)", () => {
    // El strip "Cuotas pagadas en su totalidad" fue eliminado (2026-Q3 cleanup):
    // redundaba con el KPI "Pagado" del header y con el badge "Pagado" de cada
    // PaymentTimelineNode. Estos asserts documentan la NO presencia del strip
    // y que la lista de nodos sigue funcionando normalmente.
    it("does NOT render celebratory strip when all payments are COMPLETED", () => {
      const { container } = render(
        <PaymentsTimeline
          payments={[
            mockPayment({ id: "p1", status: "COMPLETED" }),
            mockPayment({ id: "p2", status: "COMPLETED" }),
          ]}
          isActive={true} overdueCount={0} overdueAmount={0}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.queryByText(/cuotas pagadas en su totalidad/i)).toBeNull();
      // Pero los timeline nodes sí se renderizan (no se rompió la lista)
      const nodes = container.querySelectorAll("[data-testid^=timeline-node-]");
      expect(nodes.length).toBe(2);
    });
    it("does NOT render celebratory strip when there are pending payments", () => {
      render(
        <PaymentsTimeline
          payments={[
            mockPayment({ id: "p1", status: "COMPLETED" }),
            mockPayment({ id: "p2", status: "PENDING" }),
          ]}
          isActive={true} overdueCount={0} overdueAmount={0}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.queryByText(/cuotas pagadas en su totalidad/i)).toBeNull();
    });
  });

  describe("empty state", () => {
    it("renders empty state when payments.length === 0", () => {
      render(
        <PaymentsTimeline
          payments={[]} isActive={true} overdueCount={0} overdueAmount={0}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByText("Aún no generaste cuotas")).toBeTruthy();
    });
    it("empty state no muestra CTA 'Agregar Pago' (vive en el header de la sección padre)", () => {
      render(
        <PaymentsTimeline
          payments={[]} isActive={true} overdueCount={0} overdueAmount={0}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /agregar pago/i })).toBeNull();
    });
    it("empty state does not show CTA when inactive", () => {
      render(
        <PaymentsTimeline
          payments={[]} isActive={false} overdueCount={0} overdueAmount={0}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByText("Aún no generaste cuotas")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /agregar pago/i })).toBeNull();
    });
  });

  describe("timeline nodes", () => {
    it("renders one timeline node per payment", () => {
      const { container } = render(
        <PaymentsTimeline
          payments={[
            mockPayment({ id: "p1" }),
            mockPayment({ id: "p2" }),
          ]}
          isActive={true} overdueCount={0} overdueAmount={0}
          onGenerateLink={vi.fn()}
        />
      );
      const nodes = container.querySelectorAll("[data-testid^=timeline-node-]");
      expect(nodes.length).toBe(2);
    });
    it("sorts by installmentIndex ascending", () => {
      const { container } = render(
        <PaymentsTimeline
          payments={[
            mockPayment({ id: "p3", installmentIndex: 3 }),
            mockPayment({ id: "p1", installmentIndex: 1 }),
            mockPayment({ id: "p2", installmentIndex: 2 }),
          ]}
          isActive={true} overdueCount={0} overdueAmount={0}
          onGenerateLink={vi.fn()}
        />
      );
      const nodes = container.querySelectorAll("[data-testid^=timeline-node-]");
      expect(nodes[0].getAttribute("data-testid")).toBe("timeline-node-p1");
      expect(nodes[1].getAttribute("data-testid")).toBe("timeline-node-p2");
      expect(nodes[2].getAttribute("data-testid")).toBe("timeline-node-p3");
    });
  });
});
