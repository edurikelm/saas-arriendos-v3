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
    // El nodo del timeline reorganizó su layout en 3 columnas (info / monto / acciones).
    // "Cuota X de Y" ahora vive en la fila meta con icono Hash, ya no en un eyebrow
    // superior. Mantenemos los asserts de presencia del texto + fallback por index.
    it("renders installment number inside meta row (Hash icon + Cuota X de Y)", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ installmentIndex: 3 })}
          index={2} total={6} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      expect(screen.getByText(/Cuota 3 de 6/)).toBeTruthy();
    });
    it("uses index+1 when installmentIndex is null", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ installmentIndex: null })}
          index={4} total={6} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      expect(screen.getByText(/Cuota 5 de 6/)).toBeTruthy();
    });
    it("renders 3-column desktop layout (info / amount / actions)", () => {
      // El nodo expone las 3 columnas como bloques flex en el wrapper interior.
      // Verificamos que el monto vive en su propia columna con `text-xl` (kicker
      // 10px) y que sigue siendo tabular. Usamos status=PENDING para que el kicker
      // diga "Monto a pagar" (la maqueta muestra el caso pendiente).
      const { container } = render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING", amount: "250000", paidAt: null })}
          index={0} total={4} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      const amount = container.querySelector("p.text-xl.font-bold.tabular-nums");
      expect(amount).toBeTruthy();
      expect(amount?.textContent).toBe("$250.000");
      // El kicker "Monto a pagar" también existe (10px whisper)
      expect(container.querySelector("p.text-\\[10px\\].font-bold.uppercase.tracking-wider")?.textContent).toContain(
        "Monto a pagar",
      );
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
    it("PENDING upcoming within 7 days uses warning bar (matches KPI Pendiente)", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={5} isActive={true}
        />
      );
      const dot = document.querySelector("[class*=\"bg-warning\"]");
      expect(dot).toBeTruthy();
    });
    it("PENDING far future uses warning bar (matches KPI Pendiente)", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={30} isActive={true}
        />
      );
      const dot = document.querySelector("[class*=\"bg-warning\"]");
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
    // Cascada primaria alineada con ACTION_CONFIG / payment-row-actions.tsx.
    // El bug original etiquetaba "Enviar link" ambas ramas (generate + sendLink).
    // Tras el fix, generate → "Generar link" (primary), copy → "Copiar link"
    // (primary), sendLink → secundario en dropdown.
    it("PENDING MERCADO_PAGO without initPoint shows Generar link as primary", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING", method: "MERCADO_PAGO", initPoint: null })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={3} isActive={true}
          onGenerateLink={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /generar link/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /enviar link/i })).toBeNull();
    });
    it("PENDING MERCADO_PAGO with valid initPoint (sin onSendLink) shows Copiar link as primary", () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      render(
        <PaymentTimelineNode
          payment={mockPayment({
            status: "PENDING",
            method: "MERCADO_PAGO",
            initPoint: "https://mp.com/link",
            expiresAt: tomorrow.toISOString(),
          })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={3} isActive={true}
        />
      );
      // Sin onSendLink, primary = "Copiar link" (fallback defensivo). La cascada
      // con onSendLink se cubre en el test siguiente.
      expect(screen.getByRole("button", { name: /copiar link/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /enviar link/i })).toBeNull();
    });
    it("PENDING MERCADO_PAGO with valid initPoint + onSendLink: primary = 'Enviar link' (sin duplicación)", () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      render(
        <PaymentTimelineNode
          payment={mockPayment({
            status: "PENDING",
            method: "MERCADO_PAGO",
            initPoint: "https://mp.com/link",
            expiresAt: tomorrow.toISOString(),
          })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={3} isActive={true}
          onSendLink={vi.fn()}
          onMarkPaid={vi.fn()}
        />
      );
      // Decisión local: con onSendLink, primary = "Enviar link". La secundaria
      // sendLink se omite porque ya es primary (evita duplicación visible).
      expect(screen.getByRole("button", { name: /enviar link/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /marcar pagado/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /copiar link/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /más acciones/i })).toBeNull();
    });
    it("PENDING MERCADO_PAGO with expired initPoint shows Regenerar link as primary", () => {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      render(
        <PaymentTimelineNode
          payment={mockPayment({
            status: "PENDING",
            method: "MERCADO_PAGO",
            initPoint: "https://mp.com/link",
            expiresAt: yesterday.toISOString(),
          })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={3} isActive={true}
          onRegenerateLink={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /regenerar link/i })).toBeTruthy();
    });
    it("PENDING overdue (no MP) shows Marcar pagado destructive", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING", method: "CASH" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={-5} isActive={true}
          onMarkPaid={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /marcar pagado/i })).toBeTruthy();
    });
  });

  describe("UX rule: 1 secundaria → inline, 2+ → dropdown", () => {
    it("PENDING MERCADO_PAGO sin link: muestra 'Generar link' + 'Marcar pagado' inline (sin dropdown)", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING", method: "MERCADO_PAGO", initPoint: null })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={3} isActive={true}
          onGenerateLink={vi.fn()}
          onMarkPaid={vi.fn()}
        />
      );
      // Ambos botones visibles inline.
      expect(screen.getByRole("button", { name: /generar link/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /marcar pagado/i })).toBeTruthy();
      // Sin dropdown: solo hay 1 secundaria (markPaid).
      expect(screen.queryByRole("button", { name: /m\u00e1s acciones/i })).toBeNull();
    });
    it("PENDING MERCADO_PAGO expired: muestra 'Regenerar link' + 'Marcar pagado' inline (sin dropdown)", () => {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      render(
        <PaymentTimelineNode
          payment={mockPayment({
            status: "PENDING",
            method: "MERCADO_PAGO",
            initPoint: "https://mp.com/link",
            expiresAt: yesterday.toISOString(),
          })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={3} isActive={true}
          onRegenerateLink={vi.fn()}
          onMarkPaid={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /regenerar link/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /marcar pagado/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /m\u00e1s acciones/i })).toBeNull();
    });
    it("PENDING MERCADO_PAGO con link vigente + onMarkPaid + onSendLink: primary Enviar link + 1 secundaria", () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      render(
        <PaymentTimelineNode
          payment={mockPayment({
            status: "PENDING",
            method: "MERCADO_PAGO",
            initPoint: "https://mp.com/link",
            expiresAt: tomorrow.toISOString(),
          })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={3} isActive={true}
          onMarkPaid={vi.fn()}
          onSendLink={vi.fn()}
        />
      );
      // Primary "Enviar link" + secundaria "Marcar pagado" inline. Antes esto
      // era primary "Copiar link" + secundarias "Marcar pagado" + "Enviar link".
      expect(screen.getByRole("button", { name: /enviar link/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /marcar pagado/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /copiar link/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /m\u00e1s acciones/i })).toBeNull();
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

  describe("badge label urgency", () => {
    // El color del badge (variant warning) es uniforme para todo PENDING (matches KPI),
    // pero el TEXTO refleja daysFromNow: el usuario no debe ver "Vence hoy" en un pago
    // que vence el 1 de octubre (futuro). Bug histórico: tone=warning mapeaba a
    // "Vence hoy" indiscriminadamente.
    it("shows 'Vence hoy' only when daysFromNow === 0", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={0} isActive={true}
        />
      );
      expect(screen.getByText("Vence hoy")).toBeTruthy();
    });
    it("shows 'Pendiente' (not 'Vence hoy') when payment is in the future", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "PENDING" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={30} isActive={true}
        />
      );
      expect(screen.getByText("Pendiente")).toBeTruthy();
      expect(screen.queryByText("Vence hoy")).toBeNull();
    });
    it("shows 'Pagado' for COMPLETED payments", () => {
      render(
        <PaymentTimelineNode
          payment={mockPayment({ status: "COMPLETED" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />
      );
      expect(screen.getByText("Pagado")).toBeTruthy();
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

  describe("method label rendering (no MP badge)", () => {
    it("renders only method label, no MP badge (Efectivo)", () => {
      const { container } = render(
        <PaymentTimelineNode
          payment={mockPayment({ method: "CASH", status: "COMPLETED" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />,
      );
      expect(screen.getByText("Efectivo")).toBeTruthy();
      const badges = container.querySelectorAll('span[aria-hidden="true"]');
      expect(Array.from(badges).some((el) => el.textContent?.trim() === "MP")).toBe(false);
    });
    it("renders only method label, no MP badge (Transferencia)", () => {
      const { container } = render(
        <PaymentTimelineNode
          payment={mockPayment({ method: "TRANSFER", status: "COMPLETED" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />,
      );
      expect(screen.getByText("Transferencia")).toBeTruthy();
      const badges = container.querySelectorAll('span[aria-hidden="true"]');
      expect(Array.from(badges).some((el) => el.textContent?.trim() === "MP")).toBe(false);
    });
    it("renders only method label, no MP badge (Mercado Pago)", () => {
      const { container } = render(
        <PaymentTimelineNode
          payment={mockPayment({ method: "MERCADO_PAGO", status: "COMPLETED" })}
          index={0} total={3} nowKey="2025-01-01" daysFromNow={10} isActive={true}
        />,
      );
      expect(screen.getByText("Mercado Pago")).toBeTruthy();
      const badges = container.querySelectorAll('span[aria-hidden="true"]');
      expect(Array.from(badges).some((el) => el.textContent?.trim() === "MP")).toBe(false);
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
