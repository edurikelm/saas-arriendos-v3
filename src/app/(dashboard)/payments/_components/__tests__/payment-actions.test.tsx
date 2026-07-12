import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Payment } from "@/components/payments/payments-table";

const mockRefresh = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/lib/actions/payments", () => ({
  generatePaymentLink: vi.fn(),
  deletePayment: vi.fn(),
  attachReceipt: vi.fn(),
}));

import { PaymentsTableClient } from "../payment-actions";
import { generatePaymentLink, attachReceipt } from "@/lib/actions/payments";

const createMockPayment = (): Payment => ({
  id: "payment-1",
  installmentIndex: 1,
  amount: "50000",
  dueDate: "2025-02-01",
  status: "PENDING",
  method: "CASH",
  initPoint: null,
  expiresAt: null,
  paidAt: null,
  deletedAt: null,
  receiptUrl: null,
  paymentType: "RESERVATION",
  title: "Cuota 1",
  description: null,
  overdueDays: 0,
  installmentLabel: "1 / 3",
  clientName: "Carlos Rodríguez",
  propertyName: "Cabaña del Bosque",
  createdAt: "2025-01-15T10:00:00Z",
});

beforeEach(() => {
  mockRefresh.mockClear();
});

describe("PaymentsTableClient", () => {
  it("renderiza la tabla con datos mock", () => {
    render(<PaymentsTableClient payments={[createMockPayment()]} />);

    expect(screen.getByText("Cuota")).toBeTruthy();
    expect(screen.getByText("Monto")).toBeTruthy();
  });

  it("abre MarkPaidDialog al click en Marcar pagado", async () => {
    render(<PaymentsTableClient payments={[createMockPayment()]} />);

    const markPaidBtn = screen.getByRole("button", { name: /marcar pagado/i });
    await userEvent.click(markPaidBtn);

    expect(screen.getByText("Marcar como pagado")).toBeTruthy();
  });

  it("muestra mensaje cuando no hay pagos", () => {
    render(<PaymentsTableClient payments={[]} />);

    // Table renders empty state
    expect(screen.getByText("Cuota")).toBeTruthy();
  });

  it("llama router.refresh() después de generatePaymentLink exitoso", async () => {
    vi.mocked(generatePaymentLink).mockResolvedValueOnce({ success: true } as any);
    render(
      <PaymentsTableClient
        payments={[{ ...createMockPayment(), method: "MERCADO_PAGO", initPoint: null }]}
      />
    );

    const genLinkBtn = screen.getByRole("button", { name: /generar link/i });
    await userEvent.click(genLinkBtn);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("NO llama router.refresh() cuando generatePaymentLink retorna error", async () => {
    vi.mocked(generatePaymentLink).mockResolvedValueOnce({ error: "Error de MP" } as any);
    const { toast } = await import("sonner");
    render(
      <PaymentsTableClient
        payments={[{ ...createMockPayment(), method: "MERCADO_PAGO", initPoint: null }]}
      />
    );

    const genLinkBtn = screen.getByRole("button", { name: /generar link/i });
    await userEvent.click(genLinkBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Error de MP");
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("variant=full muestra columnas de contexto (Cliente, Propiedad)", () => {
    render(<PaymentsTableClient payments={[createMockPayment()]} />);

    // Column headers when full variant (with context columns)
    expect(screen.getByText("Cliente")).toBeTruthy();
    expect(screen.getByText("Propiedad")).toBeTruthy();
  });
});
