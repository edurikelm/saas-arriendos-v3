import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  regeneratePaymentLink: vi.fn(),
  restorePayment: vi.fn(),
}));

/**
 * `useMediaQuery` decide tabla vs lista, y jsdom no implementa `matchMedia`.
 * Default = desktop (`matches: false`), que es la vista de tabla que afirman
 * los tests de este archivo. `setViewport` cambia a móvil donde haga falta.
 *
 * `configurable: true` no es opcional: sin eso la propiedad queda
 * no-configurable y el teardown de jsdom en modo estricto tira "Cannot delete
 * property 'matchMedia'", que vitest reporta como Unhandled Error y hace salir
 * la suite en 1 aunque todo pase. Mismo patrón que `occupancy-strip.test.tsx`.
 */
function setViewport(isMobile: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: isMobile,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => setViewport(false));
afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

import { PaymentsTableClient } from "../payment-actions";
import { generatePaymentLink, deletePayment, restorePayment } from "@/lib/actions/payments";

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

    expect(screen.getByText("Cliente")).toBeTruthy();
    expect(screen.getByText("Monto")).toBeTruthy();
  });

  it("abre MarkPaidDialog al click en Marcar como pagado", async () => {
    render(<PaymentsTableClient payments={[createMockPayment()]} />);

    const markPaidBtn = screen.getByRole("button", { name: /marcar como pagado/i });
    await userEvent.click(markPaidBtn);

    // El botón sigue en el DOM + aparece el título del dialog → >= 2 ocurrencias.
    expect(screen.getAllByText("Marcar como pagado").length).toBeGreaterThanOrEqual(2);
  });

  it("muestra la tabla con sus encabezados cuando no hay pagos", () => {
    render(<PaymentsTableClient payments={[]} />);

    expect(screen.getByText("Cliente")).toBeTruthy();
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

  it("la propiedad va bajo el cliente, no en su propia columna", () => {
    render(<PaymentsTableClient payments={[createMockPayment()]} />);

    const headers = Array.from(document.querySelectorAll("thead th")).map((th) =>
      th.textContent?.trim(),
    );
    expect(headers).toContain("Cliente");
    expect(headers).not.toContain("Propiedad");
    // Pero el dato sigue estando, como segunda línea de esa celda.
    expect(screen.getByText("Cabaña del Bosque")).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// handleDeletePayment — confirm + undo toast
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentsTableClient - handleDeletePayment", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    vi.clearAllMocks();
  });

  /**
   * Abre el borrado y devuelve el botón de confirmar del diálogo.
   *
   * El de la fila lleva `aria-label` "Eliminar pago · pago de $X" y el del
   * diálogo es exactamente "Eliminar pago", así que el ancla distingue.
   */
  async function abrirBorrado() {
    // Con 1 secundaria destructiva, el delete es inline (icon-only, no dropdown).
    await userEvent.click(screen.getByRole("button", { name: /eliminar pago ·/i }));
    return screen.getByRole("button", { name: /^eliminar pago$/i });
  }

  it("pide confirmación antes de borrar, con el diálogo del sistema", async () => {
    // Antes era `window.confirm`. Ahora es `ConfirmDialog`, igual que el mismo
    // borrado en el detalle de reserva.
    render(<PaymentsTableClient payments={[{ ...createMockPayment(), method: "CASH" }]} />);

    await abrirBorrado();

    // Por la descripción y no por el título: "Eliminar pago" es a la vez el
    // título del diálogo y la etiqueta de su botón de confirmar.
    expect(screen.getByText(/se eliminará del registro/i)).toBeTruthy();
    expect(deletePayment).not.toHaveBeenCalled();
  });

  it("NO llama a deletePayment si se cancela", async () => {
    render(<PaymentsTableClient payments={[{ ...createMockPayment(), method: "CASH" }]} />);

    await abrirBorrado();
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(deletePayment).not.toHaveBeenCalled();
  });

  it("llama deletePayment y muestra toast con 'Deshacer' tras delete exitoso", async () => {
    vi.mocked(deletePayment).mockResolvedValueOnce({ success: true } as any);

    render(<PaymentsTableClient payments={[{ ...createMockPayment(), method: "CASH" }]} />);

    await userEvent.click(await abrirBorrado());

    await waitFor(() => {
      expect(deletePayment).toHaveBeenCalledWith("payment-1");
    });

    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith(
      "Pago eliminado",
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({ label: "Deshacer" }),
      })
    );

  });

  it("llama a restorePayment al hacer click en 'Deshacer'", async () => {
    vi.mocked(deletePayment).mockResolvedValueOnce({ success: true } as any);
    vi.mocked(restorePayment).mockResolvedValueOnce({ success: true } as any);

    render(<PaymentsTableClient payments={[{ ...createMockPayment(), method: "CASH" }]} />);

    await userEvent.click(await abrirBorrado());

    await waitFor(() => {
      expect(deletePayment).toHaveBeenCalled();
    });

    // Find the toast success call with undo action
    const { toast } = await import("sonner");
    const successCalls = vi.mocked(toast.success).mock.calls;
    const undoCall = successCalls.find(
      (call) =>
        call[0] === "Pago eliminado" &&
        call[1] &&
        (call[1] as any).action?.label === "Deshacer"
    );
    expect(undoCall).toBeTruthy();

    // Simulate clicking Undo by calling the onClick
    const toastOptions = undoCall?.[1] as any;
    await toastOptions.action.onClick();

    await waitFor(() => {
      expect(restorePayment).toHaveBeenCalledWith("payment-1");
    });

  });
});

// ────────────────────────────────────────────────────────────────────────────
// Tabla vs lista según el ancho
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentsTableClient - corte por viewport", () => {
  it("en escritorio renderiza la tabla", () => {
    setViewport(false);

    render(<PaymentsTableClient payments={[createMockPayment()]} />);

    expect(document.querySelector("table")).toBeTruthy();
  });

  it("en móvil renderiza la lista, no la tabla", () => {
    // La tabla necesitaba 1668px: en 375px el monto, el estado y las acciones
    // quedaban a más de 1300px de scroll horizontal, y como la fila no es
    // clickeable eso dejaba la página de solo lectura en el teléfono.
    setViewport(true);

    render(<PaymentsTableClient payments={[createMockPayment()]} />);

    expect(document.querySelector("table")).toBeNull();
    expect(screen.getByText("Cabaña del Bosque")).toBeTruthy();
  });

  it("monta una sola de las dos vistas, sin duplicar acciones", () => {
    // Con `hidden md:block` se montaban las dos y cada botón quedaba dos veces
    // en el DOM. `getByRole` es la afirmación: falla si hay más de uno.
    setViewport(true);

    render(<PaymentsTableClient payments={[createMockPayment()]} />);

    expect(screen.getByRole("button", { name: /marcar como pagado/i })).toBeTruthy();
  });
});

