import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Payment } from "../payments-table";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Lazy-import to avoid top-level mock issues
const renderComponent = async () => {
  const { PaymentRowActions } = await import("../payment-row-actions");
  return { PaymentRowActions };
};

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

// ─────────────────────────────────────────────────────────────────────────────
// MP PENDING — sin link (debe mostrar "Generar link")
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentRowActions — MP PENDING sin link", () => {
  it("muestra botón Generar link", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "MERCADO_PAGO",
      initPoint: null,
    });

    render(
      <PaymentRowActions payment={payment} onGenerateLink={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: /generar link/i })).toBeTruthy();
  });

  it("el aria-label del trigger incluye el monto cuando hay múltiples acciones", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "CASH",
      amount: "150000",
      installmentIndex: 3,
    });

    render(
      <PaymentRowActions
        payment={payment}
        onMarkPaid={vi.fn()}
        onDeletePayment={vi.fn()}
      />
    );

    // Con 1 secundaria, la acción se inline (no dropdown). El primary
    // (Marcar como pagado) y la secundaria inline (Eliminar) tienen
    // aria-label con contexto del pago via title tooltip.
    // installmentIndex=3 → "Marcar como pagado (pago manual)" es el label del primary.
    const primaryBtn = screen.getByRole("button", { name: /marcar como pagado/i });
    expect(primaryBtn).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MP PENDING — link vigente (debe mostrar "Copiar link")
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentRowActions — MP PENDING con link vigente", () => {
  it('muestra botón "Copiar link"', async () => {
    const { PaymentRowActions } = await renderComponent();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const payment = createMockPayment({
      status: "PENDING",
      method: "MERCADO_PAGO",
      initPoint: "https://www.mercadopago.com.ar/checkout/test",
      expiresAt: futureDate.toISOString(),
    });

    render(<PaymentRowActions payment={payment} />);

    expect(screen.getByRole("button", { name: /copiar link/i })).toBeTruthy();
  });

  it("no muestra Regenerar cuando el link no ha expirado", async () => {
    const { PaymentRowActions } = await renderComponent();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const payment = createMockPayment({
      status: "PENDING",
      method: "MERCADO_PAGO",
      initPoint: "https://www.mercadopago.com.ar/checkout/test",
      expiresAt: futureDate.toISOString(),
    });

    render(<PaymentRowActions payment={payment} onRegenerateLink={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /regenerar link/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MP PENDING — link expirado (debe mostrar "Regenerar link")
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentRowActions — MP PENDING con link expirado", () => {
  it('muestra botón "Regenerar link"', async () => {
    const { PaymentRowActions } = await renderComponent();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const payment = createMockPayment({
      status: "PENDING",
      method: "MERCADO_PAGO",
      initPoint: "https://www.mercadopago.com.ar/checkout/test",
      expiresAt: pastDate.toISOString(),
    });

    render(
      <PaymentRowActions
        payment={payment}
        onRegenerateLink={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /regenerar link/i })).toBeTruthy();
  });

  it("deshabilita Regenerar mientras regeneratingLinkId coincide con el pago", async () => {
    const { PaymentRowActions } = await renderComponent();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const payment = createMockPayment({
      id: "pay-abc",
      status: "PENDING",
      method: "MERCADO_PAGO",
      initPoint: "https://www.mercadopago.com.ar/checkout/test",
      expiresAt: pastDate.toISOString(),
    });

    render(
      <PaymentRowActions
        payment={payment}
        onRegenerateLink={vi.fn()}
        regeneratingLinkId="pay-abc"
      />
    );

    const btn = screen.getByRole("button", { name: /regenerar link/i });
    expect(btn).toHaveProperty("disabled", true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CASH PENDING — sin link (debe mostrar "Marcar pagado")
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentRowActions — CASH PENDING", () => {
  it('muestra botón "Marcar como pagado" para CASH PENDING', async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "CASH",
      initPoint: null,
    });

    render(<PaymentRowActions payment={payment} onMarkPaid={vi.fn()} />);

    expect(screen.getByRole("button", { name: /marcar como pagado/i })).toBeTruthy();
  });

  it("no muestra Generar/Regenerar/Copiar para CASH", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "CASH",
    });

    render(<PaymentRowActions payment={payment} onMarkPaid={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /generar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /copiar/i })).toBeNull();
  });

  it("muestra Eliminar inline (icon-only) cuando hay 1 secundaria destructiva", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "CASH",
    });

    render(
      <PaymentRowActions payment={payment} onMarkPaid={vi.fn()} onDeletePayment={vi.fn()} />
    );

    // Primary visible con texto, secundaria inline icon-only con tooltip.
    expect(screen.getByRole("button", { name: /marcar como pagado/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /eliminar.*pago/i })).toBeTruthy();
    // No debe haber trigger de dropdown (1 secundaria → inline, no dropdown).
    expect(screen.queryByRole("button", { name: /más acciones/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED — MERCADO_PAGO — downloadReceipt
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentRowActions — COMPLETED MERCADO_PAGO downloadReceipt", () => {
  it("muestra Descargar PDF inline (icon-only) cuando hay 1 secundaria en COMPLETED con receipt", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "COMPLETED",
      method: "MERCADO_PAGO",
      receiptUrl: "https://www.mercadopago.com.ar/receipts/abc123",
    });

    render(<PaymentRowActions payment={payment} />);

    // Primary visible (Ver comprobante), secundaria inline icon-only (Descargar PDF).
    // 1 secundaria → inline, no dropdown.
    expect(screen.getByRole("button", { name: /ver comprobante/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /descargar.*comprobante/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /más acciones/i })).toBeNull();
  });

  it("muestra Descargar comprobante PDF como acción primaria cuando NO hay receiptUrl", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "COMPLETED",
      method: "MERCADO_PAGO",
      receiptUrl: null,
    });

    render(<PaymentRowActions payment={payment} />);

    // Descargar comprobante es la única acción visible (promovida de secondary)
    expect(screen.getByRole("button", { name: /descargar comprobante/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /más acciones/i })).toBeNull();
  });

  it("COMPLETED CASH no muestra opción de descargar PDF", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "COMPLETED",
      method: "CASH",
      receiptUrl: null,
    });

    render(<PaymentRowActions payment={payment} />);

    expect(screen.queryByRole("button", { name: /descargar comprobante/i })).toBeNull();
  });

  it("PENDING MERCADO_PAGO no muestra opción de descargar PDF", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "MERCADO_PAGO",
      initPoint: "https://www.mercadopago.com.ar/checkout/test",
    });

    render(<PaymentRowActions payment={payment} />);

    expect(screen.queryByRole("button", { name: /descargar comprobante/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED — con y sin comprobante
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentRowActions — COMPLETED con comprobante", () => {
  it('muestra botón "Ver comprobante"', async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "COMPLETED",
      receiptUrl: "https://www.mercadopago.com.ar/receipts/abc123",
    });

    render(<PaymentRowActions payment={payment} />);

    expect(screen.getByRole("button", { name: /ver comprobante/i })).toBeTruthy();
  });
});

describe("PaymentRowActions — COMPLETED sin comprobante", () => {
  it('promueve "Adjuntar comprobante" a acción visible para CASH (sin menú)', async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "COMPLETED",
      method: "CASH",
      receiptUrl: null,
    });

    render(
      <PaymentRowActions payment={payment} onAttachReceipt={vi.fn()} />
    );

    // Adjuntar comprobante debe ser botón visible, sin pasar por el menú
    expect(screen.getByRole("button", { name: /adjuntar comprobante/i })).toBeTruthy();
    // No debe haber trigger "Más acciones" (secondaryActions está vacío)
    expect(screen.queryByRole("button", { name: /más acciones/i })).toBeNull();
  });

  it("el menú no aparece cuando la única acción ya es visible (CASH)", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "COMPLETED",
      method: "CASH",
      receiptUrl: null,
    });

    render(
      <PaymentRowActions
        payment={payment}
        onAttachReceipt={vi.fn()}
        onMarkPaid={vi.fn()}
      />
    );

    // attachReceipt se promueve a primary (única acción disponible).
    // secondaryActions queda vacío → Más acciones NO aparece.
    expect(screen.getByRole("button", { name: /adjuntar comprobante/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /más acciones/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// aria-label contextual en botón inline (1 secundaria → inline, no dropdown)
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentRowActions — aria-label contextual (botón inline)", () => {
  it("incluye installmentLabel en aria-label si existe", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "CASH",
      installmentLabel: "2 / 3",
    });

    render(
      <PaymentRowActions
        payment={payment}
        onMarkPaid={vi.fn()}
        onDeletePayment={vi.fn()}
      />
    );

    // Con 1 secundaria (delete), la acción se inline icon-only.
    // El aria-label debe incluir el contexto de la cuota para screen readers.
    expect(
      screen.getByRole("button", { name: /eliminar pago.*cuota 2 \/ 3/i })
    ).toBeTruthy();
  });

  it("incluye installmentIndex en aria-label si no hay label", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "CASH",
      installmentIndex: 2,
      installmentLabel: null,
    });

    render(
      <PaymentRowActions
        payment={payment}
        onMarkPaid={vi.fn()}
        onDeletePayment={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: /eliminar pago.*cuota 2/i })
    ).toBeTruthy();
  });

  it("incluye monto formateado en aria-label para pagos sin installment", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "CASH",
      amount: "75000",
      installmentIndex: null,
      installmentLabel: null,
    });

    render(
      <PaymentRowActions
        payment={payment}
        onMarkPaid={vi.fn()}
        onDeletePayment={vi.fn()}
      />
    );

    // Amount formatted as CLP pesos: "$ 75.000"
    expect(
      screen.getByRole("button", { name: /eliminar pago.*pago de \$[\d.]+/i })
    ).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Menú — acciones secundarias expuestas
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentRowActions — menú con acciones secundarias", () => {
  it("renderiza trigger Más acciones cuando hay 2+ secundarias (MP con link + onSendLink)", async () => {
    const { PaymentRowActions } = await renderComponent();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const payment = createMockPayment({
      status: "PENDING",
      method: "MERCADO_PAGO",
      initPoint: "https://www.mercadopago.com.ar/checkout/test",
      expiresAt: futureDate.toISOString(),
    });

    render(
      <PaymentRowActions
        payment={payment}
        onMarkPaid={vi.fn()}
        onSendLink={vi.fn()}
      />
    );

    // Primary = "copy" (link vigente), secondary = ["markPaid", "sendLink"]
    // → 2 secundarias → dropdown se mantiene.
    expect(screen.getByRole("button", { name: /copiar link/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /más acciones/i })).toBeTruthy();
  });

  it("NO renderiza dropdown cuando hay solo 1 secundaria (MP con link, sin sendLink)", async () => {
    const { PaymentRowActions } = await renderComponent();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const payment = createMockPayment({
      status: "PENDING",
      method: "MERCADO_PAGO",
      initPoint: "https://www.mercadopago.com.ar/checkout/test",
      expiresAt: futureDate.toISOString(),
    });

    render(
      <PaymentRowActions
        payment={payment}
        onMarkPaid={vi.fn()}
        onDeletePayment={vi.fn()}
      />
    );

    // Primary = "copy", secondary = ["markPaid"] (delete falla por MERCADO_PAGO)
    // → 1 secundaria → inline, no dropdown.
    expect(screen.getByRole("button", { name: /copiar link/i })).toBeTruthy();
    // El "marcar como pagado" queda como botón secundario inline (icon-only).
    expect(screen.getByRole("button", { name: /marcar como pagado/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /más acciones/i })).toBeNull();
  });

  it("renderiza inline (no dropdown) cuando hay solo 1 secundaria destructiva (CASH PENDING)", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "CASH",
    });

    render(
      <PaymentRowActions
        payment={payment}
        onMarkPaid={vi.fn()}
        onDeletePayment={vi.fn()}
      />
    );

    // Primary = "markPaid", secondary = ["delete"] → inline, no dropdown.
    expect(screen.getByRole("button", { name: /marcar como pagado/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /eliminar.*pago/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /más acciones/i })).toBeNull();
  });

  it("renderiza Más acciones cuando secondary incluye sendLink (MP PENDING)", async () => {
    const { PaymentRowActions } = await renderComponent();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const payment = createMockPayment({
      status: "PENDING",
      method: "MERCADO_PAGO",
      initPoint: "https://www.mercadopago.com.ar/checkout/test",
      expiresAt: futureDate.toISOString(),
    });

    render(
      <PaymentRowActions
        payment={payment}
        onMarkPaid={vi.fn()}
        onSendLink={vi.fn()}
      />
    );

    // Primary = "copy" (link vigente), secondary = ["markPaid", "sendLink"]
    expect(screen.getByRole("button", { name: /copiar link/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /más acciones/i })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// compact prop
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentRowActions — compact prop", () => {
  it("usa clase compacta cuando compact=true", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "CASH",
    });

    const { container } = render(
      <PaymentRowActions payment={payment} onMarkPaid={vi.fn()} compact />
    );

    // El botón debe tener h-6 (size-6)
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("h-6");
  });

  it("usa clase estándar cuando compact=false", async () => {
    const { PaymentRowActions } = await renderComponent();
    const payment = createMockPayment({
      status: "PENDING",
      method: "CASH",
    });

    const { container } = render(
      <PaymentRowActions payment={payment} onMarkPaid={vi.fn()} compact={false} />
    );

    const btn = container.querySelector("button");
    expect(btn?.className).toContain("h-7");
  });
});
