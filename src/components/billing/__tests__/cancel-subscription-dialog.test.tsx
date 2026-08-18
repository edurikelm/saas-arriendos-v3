import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CancelSubscriptionDialog } from "../cancel-subscription-dialog";

const { mockCancelMySubscription } = vi.hoisted(() => ({
  mockCancelMySubscription: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })),
}));

vi.mock("@/lib/actions/subscriptions", () => ({
  cancelMySubscription: mockCancelMySubscription,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("CancelSubscriptionDialog", () => {
  beforeEach(() => {
    mockCancelMySubscription.mockReset();
  });

  it("renderiza correctamente cuando open=true: muestra titulo + lista de features + botones", async () => {
    render(
      <CancelSubscriptionDialog
        open={true}
        onOpenChange={vi.fn()}
        currentPeriodEnd={new Date("2026-08-15T12:00:00Z")}
      />
    );

    // Titulo del dialog
    expect(screen.getByText("Cancelar suscripcion PRO")).toBeTruthy();

    // Lista de features perdidas
    expect(
      screen.getByText("Sincronización iCal (Airbnb, Booking, VRBO)")
    ).toBeTruthy();
    expect(screen.getByText("Documentos de reserva (contratos, anexos)")).toBeTruthy();
    expect(screen.getByText("Propiedades y clientes ilimitados")).toBeTruthy();
    expect(screen.getByText("Reportes con rango completo de fechas")).toBeTruthy();

    // Botones
    expect(screen.getByRole("button", { name: /mantener pro/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /cancelar suscripcion/i })
    ).toBeTruthy();
  });

  it("muestra fecha formateada de currentPeriodEnd en el copy (hasta el 15 de agosto de 2026)", async () => {
    render(
      <CancelSubscriptionDialog
        open={true}
        onOpenChange={vi.fn()}
        currentPeriodEnd={new Date("2026-08-15T12:00:00Z")}
      />
    );

    expect(
      screen.getByText(/tu plan seguirá activo hasta el/i)
    ).toBeTruthy();
    expect(screen.getByText(/15 de agosto de 2026/i)).toBeTruthy();
  });

  it("click en Mantener PRO cierra el dialogo sin llamar action", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CancelSubscriptionDialog
        open={true}
        onOpenChange={onOpenChange}
        currentPeriodEnd={new Date("2026-08-15T12:00:00Z")}
      />
    );

    const btn = screen.getByRole("button", { name: /mantener pro/i });
    await act(async () => {
      await user.click(btn);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockCancelMySubscription).not.toHaveBeenCalled();
  });

  it("click en Cancelar suscripcion llama cancelMySubscription con el reason seleccionado", async () => {
    mockCancelMySubscription.mockResolvedValue({ success: true, currentPeriodEnd: null });

    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CancelSubscriptionDialog
        open={true}
        onOpenChange={onOpenChange}
        currentPeriodEnd={new Date("2026-08-15T12:00:00Z")}
      />
    );

    // Seleccionar un motivo
    const select = screen.getByRole("combobox");
    await act(async () => {
      await user.selectOptions(select, "too_expensive");
    });

    // Click en cancelar
    const cancelBtn = screen.getByRole("button", { name: /cancelar suscripcion/i });
    await act(async () => {
      await user.click(cancelBtn);
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(mockCancelMySubscription).toHaveBeenCalledWith("too_expensive");
      });
    });
  });

  it("si reason es other, muestra Textarea para custom reason", async () => {
    const user = userEvent.setup();
    render(
      <CancelSubscriptionDialog
        open={true}
        onOpenChange={vi.fn()}
        currentPeriodEnd={new Date("2026-08-15T12:00:00Z")}
      />
    );

    const select = screen.getByRole("combobox");
    await act(async () => {
      await user.selectOptions(select, "other");
    });

    expect(screen.getByPlaceholderText(/Cuéntanos por qué cancelas/i)).toBeTruthy();
  });

  it("muestra toast de exito con la fecha formateada despues de cancelar", async () => {
    const { toast } = await import("sonner");
    mockCancelMySubscription.mockResolvedValue({
      success: true,
      currentPeriodEnd: new Date("2026-08-15T12:00:00Z"),
    });

    const user = userEvent.setup();
    render(
      <CancelSubscriptionDialog
        open={true}
        onOpenChange={vi.fn()}
        currentPeriodEnd={new Date("2026-08-15T12:00:00Z")}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: /cancelar suscripcion/i });
    await act(async () => {
      await user.click(cancelBtn);
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining("Tu plan seguirá activo hasta el")
        );
      });
    });
  });
});
