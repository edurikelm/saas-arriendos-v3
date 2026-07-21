/**
 * Tests para AdminCancelSubscriptionButton.
 *
 * Patrón: vitest + @testing-library/react + userEvent.
 * Sigue el patrón de src/components/admin/__tests__/admin-owner-notes.test.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCancelSubscriptionButton } from "../admin-cancel-subscription-button";

// ────────────────────────────────────────────────────────────────────────────
// Mocks — elevados con vi.hoisted para estar disponibles en factories
// ────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  routerRefresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  adminCancelSubscription: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    refresh: mocks.routerRefresh,
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/lib/actions/admin-subscriptions", () => ({
  adminCancelSubscription: mocks.adminCancelSubscription,
}));

// ────────────────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("AdminCancelSubscriptionButton", () => {
  // ── 1. Renderiza el botón ───────────────────────────────

  it("renderiza el botón 'Cancelar manualmente'", () => {
    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    expect(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    ).toBeTruthy();
  });

  it("renderiza con variant destructive", () => {
    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    const button = screen.getByRole("button", { name: /cancelar manualmente/i });
    expect(button.className).toContain("destructive");
  });

  // ── 2. Click abre el Dialog ─────────────────────────────

  it("al hacer click en el botón se abre el Dialog de confirmación", async () => {
    const user = userEvent.setup();
    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/cancelar suscripción manualmente/i),
      ).toBeTruthy();
    });
  });

  it("el Dialog muestra la descripción de la acción", async () => {
    const user = userEvent.setup();
    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/esta acción es irreversible desde la ui/i),
      ).toBeTruthy();
    });
  });

  // ── 3. Dialog muestra textarea y botones ────────────────

  it("el Dialog contiene el textarea para la razón", async () => {
    const user = userEvent.setup();
    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/razón/i)).toBeTruthy();
    });
  });

  it("el Dialog muestra el Subscription ID", async () => {
    const user = userEvent.setup();
    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-abc123"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/sub-abc123/i)).toBeTruthy();
    });
  });

  it("el Dialog tiene botón Volver y Confirmar cancelación", async () => {
    const user = userEvent.setup();
    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /volver/i })).toBeTruthy();
      expect(
        screen.getByRole("button", { name: /confirmar cancelación/i }),
      ).toBeTruthy();
    });
  });

  // ── 4. Confirmar sin reason el botón está deshabilitado ─

  it("el botón Confirmar cancelación está deshabilitado cuando reason está vacío", async () => {
    const user = userEvent.setup();
    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/razón/i)).toBeTruthy();
    });

    const confirmBtn = screen.getByRole("button", { name: /confirmar cancelación/i });

    // El botón debe estar deshabilitado con reason vacío
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);

    // Y la acción NO se llama
    expect(mocks.adminCancelSubscription).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  // ── 5. Confirmar con reason llama adminCancelSubscription ─

  it("al hacer click en confirmar con reason se llama adminCancelSubscription", async () => {
    const user = userEvent.setup();
    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/razón/i)).toBeTruthy();
    });

    await user.type(screen.getByLabelText(/razón/i), "Fraude detectado");

    await user.click(
      screen.getByRole("button", { name: /confirmar cancelación/i }),
    );

    await waitFor(() => {
      expect(mocks.adminCancelSubscription).toHaveBeenCalledWith({
        userId: "user-1",
        reason: "Fraude detectado",
      });
    });
  });

  // ── 6. Éxito cierra dialog y hace refresh ──────────────

  it("al confirmar exitosamente se cierra el dialog y se hace router.refresh", async () => {
    const user = userEvent.setup();
    mocks.adminCancelSubscription.mockResolvedValueOnce({
      success: true,
      subscriptionId: "sub-1",
    });

    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/razón/i)).toBeTruthy();
    });

    await user.type(
      screen.getByLabelText(/razón/i),
      "Owner requested cancellation",
    );

    await user.click(
      screen.getByRole("button", { name: /confirmar cancelación/i }),
    );

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Suscripción cancelada");
    });

    expect(mocks.routerRefresh).toHaveBeenCalled();
  });

  // ── 7. Error muestra toast con mensaje ─────────────────

  it("si la acción lanza error, se muestra toast con el mensaje", async () => {
    const user = userEvent.setup();
    mocks.adminCancelSubscription.mockRejectedValueOnce(
      new Error(
        "Solo se pueden cancelar suscripciones en estado AUTHORIZED o PAUSED",
      ),
    );

    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/razón/i)).toBeTruthy();
    });

    await user.type(screen.getByLabelText(/razón/i), "Test reason");

    await user.click(
      screen.getByRole("button", { name: /confirmar cancelación/i }),
    );

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Solo se pueden cancelar suscripciones en estado AUTHORIZED o PAUSED",
      );
    });
  });

  // ── 8. Click en Volver cierra dialog sin llamar acción ──

  it("al hacer click en Volver se cierra el dialog sin llamar acción", async () => {
    const user = userEvent.setup();
    render(
      <AdminCancelSubscriptionButton
        userId="user-1"
        subscriptionId="sub-1"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /cancelar manualmente/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/cancelar suscripción manualmente/i),
      ).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: /volver/i }));

    await waitFor(() => {
      expect(
        screen.queryByText(/cancelar suscripción manualmente/i),
      ).toBeNull();
    });

    expect(mocks.adminCancelSubscription).not.toHaveBeenCalled();
  });
});
