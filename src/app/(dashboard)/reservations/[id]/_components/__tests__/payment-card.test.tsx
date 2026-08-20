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
    it("COMPLETED payment renders 'Pagado el X' sublabel below amount (not in meta row)", () => {
      const { container } = render(
        <PaymentCard
          payment={mockPayment({ status: "COMPLETED", paidAt: "2026-08-19T12:00:00Z" })}
          index={0} total={2} nowKey="2026-08-20" isActive={true}
        />,
      );
      // El sublabel "Pagado el X" debe aparecer debajo del monto (text-success).
      const sublabel = screen.getByText(/Pagado el 19 ago 2026/i);
      expect(sublabel).toBeTruthy();
      expect(sublabel.className).toContain("text-success");
      // NO debe existir el formato antiguo "Pagado 19 ago 2026" (sin "el") en la meta row.
      // Como el formato anterior ya no se renderiza en ningún lado, basta con asegurar
      // que el texto exacto "Pagado 19 ago 2026" (sin "el") no está en el árbol.
      expect(container.textContent).not.toMatch(/^Pagado 19 ago 2026$/);
    });
    it("PENDING payment does NOT render 'Pagado el X' sublabel", () => {
      const { container } = render(
        <PaymentCard
          payment={mockPayment({ status: "PENDING", paidAt: null })}
          index={0} total={2} nowKey="2026-08-20" isActive={true}
        />,
      );
      expect(container.textContent).not.toMatch(/Pagado el/);
    });
    it("COMPLETED payment without paidAt does NOT render 'Pagado el' sublabel", () => {
      // Defensa: si el flag COMPLETED viene sin fecha de pago, el sublabel no debe
      // aparecer ni en estado vacío ("Pagado el —").
      const { container } = render(
        <PaymentCard
          payment={mockPayment({ status: "COMPLETED", paidAt: null })}
          index={0} total={2} nowKey="2026-08-20" isActive={true}
        />,
      );
      expect(container.textContent).not.toMatch(/Pagado el/);
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
    it("renders ordinal 'Pago N' (without total) for daily payments", () => {
      render(<PaymentCard payment={mockPayment({ installmentIndex: null })} index={1} total={4} nowKey="2025-01-01" isActive={true} />);
      // Solo el ordinal — el "de 4" no aporta información accionable y compite con el badge.
      expect(screen.getByText("Pago 2")).toBeTruthy();
      expect(screen.queryByText("Pago 2 de 4")).toBeNull();
    });
    it("daily payment aria-label exposes only ordinal (screen reader friendly)", () => {
      render(<PaymentCard payment={mockPayment({ installmentIndex: null })} index={1} total={4} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByLabelText("Pago 2")).toBeTruthy();
      expect(screen.queryByLabelText(/de 4/)).toBeNull();
    });
    it("renders installmentLabel directly without prepended cuota", () => {
      render(<PaymentCard payment={mockPayment({ installmentLabel: "Cuota 1 - Sep" })} index={0} total={3} nowKey="2025-01-01" isActive={true} />);
      expect(screen.getByText("Cuota 1 - Sep")).toBeTruthy();
    });
    it("renders description when present (cobros extras)", () => {
      render(
        <PaymentCard
          payment={mockPayment({
            paymentType: "EXTRA",
            title: "Limpieza extra",
            description: "Limpieza profunda post check-out por mascota.",
          })}
          index={0} total={1} nowKey="2025-01-01" isActive={true}
        />,
      );
      expect(screen.getByText("Limpieza profunda post check-out por mascota.")).toBeTruthy();
    });
    it("does not render description paragraph when description is null", () => {
      const { container } = render(
        <PaymentCard payment={mockPayment({ description: null })} index={0} total={1} nowKey="2025-01-01" isActive={true} />,
      );
      // El <p> de descripción nunca debe existir si description es null/vacío.
      expect(container.querySelector("article p.text-xs.text-muted-foreground.leading-snug")).toBeNull();
    });
    it("renders only method label, no MP badge (Mercado Pago)", () => {
      const { container } = render(
        <PaymentCard payment={mockPayment({ method: "MERCADO_PAGO" })} index={0} total={1} nowKey="2025-01-01" isActive={true} />,
      );
      expect(screen.getByText("Mercado Pago")).toBeTruthy();
      // El badge "MP" (span con bg-primary que contiene solo "MP") debe haber desaparecido.
      const badges = container.querySelectorAll('span[aria-hidden="true"]');
      const hasMpBadge = Array.from(badges).some((el) => el.textContent?.trim() === "MP");
      expect(hasMpBadge).toBe(false);
    });
    it("renders only method label, no MP badge (Efectivo / Transferencia)", () => {
      const { container: cashContainer } = render(
        <PaymentCard payment={mockPayment({ method: "CASH", status: "PENDING" })} index={0} total={1} nowKey="2025-01-01" isActive={true} />,
      );
      expect(screen.getByText("Efectivo")).toBeTruthy();
      const cashBadges = cashContainer.querySelectorAll('span[aria-hidden="true"]');
      expect(Array.from(cashBadges).some((el) => el.textContent?.trim() === "MP")).toBe(false);

      const { container: transferContainer } = render(
        <PaymentCard payment={mockPayment({ method: "TRANSFER", status: "PENDING" })} index={0} total={1} nowKey="2025-01-01" isActive={true} />,
      );
      expect(screen.getByText("Transferencia")).toBeTruthy();
      const transferBadges = transferContainer.querySelectorAll('span[aria-hidden="true"]');
      expect(Array.from(transferBadges).some((el) => el.textContent?.trim() === "MP")).toBe(false);
    });
  });

  describe("dropdown actions", () => {
    it("PENDING CASH con 1 secundaria (Eliminar) la muestra inline sin dropdown", () => {
      const onDelete = vi.fn();
      const onMarkPaid = vi.fn();
      render(
        <PaymentCard
          payment={mockPayment({ id: "pay-1", status: "PENDING", method: "CASH" })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onDeletePayment={onDelete} onMarkPaid={onMarkPaid}
        />
      );
      // UX rule: 1 secundaria → inline. Ahora todas las secundarias son inline
      // sin importar el conteo (no hay dropdown "Más acciones").
      // Copy unificado con ACTION_CONFIG (antes era "Eliminar" inline vs.
      // "Eliminar pago" en dropdown — ahora siempre "Eliminar pago").
      expect(screen.getByRole("button", { name: /marcar pagado/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /eliminar pago/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /m\u00e1s acciones/i })).toBeNull();
    });
    it("PENDING MP + link vigente + onSendLink: primary = 'Enviar link' (sin duplicación)", () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      render(
        <PaymentCard
          payment={mockPayment({
            status: "PENDING",
            method: "MERCADO_PAGO",
            initPoint: "https://mp.com/link",
            expiresAt: tomorrow.toISOString(),
          })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onMarkPaid={vi.fn()}
          onSendLink={vi.fn()}
        />
      );
      // Decisión local: cuando hay link vigente + onSendLink, primary = "Enviar link".
      // Justificación: el modal SendPaymentLinkDialog ya expone su propio botón "Copiar",
      // así que mostrar "Copiar link" + "Enviar link" como dos acciones separadas
      // duplica la misma capacidad. La secundaria queda solo "Marcar pagado" (sendLink
      // se omite porque ya es primary).
      expect(screen.getByRole("button", { name: /enviar link/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /marcar pagado/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /copiar link/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /m\u00e1s acciones/i })).toBeNull();
    });
    it("PENDING MP + link vigente + sin onSendLink: primary = 'Copiar link' (fallback defensivo)", () => {
      // Defensa: si onSendLink no se pasa, el comportamiento legacy (primary = "Copiar link")
      // se preserva. Cubre el caso edge de un callsite que no expone el flujo de envío.
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      render(
        <PaymentCard
          payment={mockPayment({
            status: "PENDING",
            method: "MERCADO_PAGO",
            initPoint: "https://mp.com/link",
            expiresAt: tomorrow.toISOString(),
          })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onMarkPaid={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /copiar link/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /enviar link/i })).toBeNull();
    });
    it("does not render Más acciones anywhere (dropdown eliminado)", () => {
      // Defensa: el botón "Más acciones" se eliminó completamente. Antes era el
      // único punto de entrada para 2+ secundarias; ahora todas son inline.
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
    it("PENDING MERCADO_PAGO with valid initPoint (sin onSendLink) shows Copiar link", () => {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      render(
        <PaymentCard
          payment={mockPayment({ status: "PENDING", method: "MERCADO_PAGO", initPoint: "https://mp.com/link", expiresAt: tomorrow.toISOString() })}
          index={0} total={3} nowKey="2025-01-01" isActive={true}
          onMarkPaid={vi.fn()}
        />
      );
      // Sin onSendLink, primary = "Copiar link" (fallback defensivo). La cascada
      // con onSendLink se cubre en "primary = 'Enviar link' (sin duplicación)".
      expect(screen.getByRole("button", { name: /copiar link/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /enviar link/i })).toBeNull();
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
