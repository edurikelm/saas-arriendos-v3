import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactivateButton } from "../reactivate-button";

const { mockReactivateMySubscription } = vi.hoisted(() => ({
  mockReactivateMySubscription: vi.fn(),
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
  reactivateMySubscription: mockReactivateMySubscription,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ReactivateButton", () => {
  beforeEach(() => {
    mockReactivateMySubscription.mockReset();
  });

  it("click en Reactivar PRO llama reactivateMySubscription", async () => {
    mockReactivateMySubscription.mockResolvedValue({
      success: true,
      subscription: { id: "sub-1", status: "AUTHORIZED", currentPeriodEnd: new Date("2026-08-15") },
    });

    const user = userEvent.setup();
    render(<ReactivateButton />);

    const btn = screen.getByRole("button", { name: /reactivar pro/i });
    await act(async () => {
      await user.click(btn);
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(mockReactivateMySubscription).toHaveBeenCalledTimes(1);
      });
    });
  });

  it("muestra textoreactivando... durante el loading", async () => {
    mockReactivateMySubscription.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, subscription: { id: "sub-1", status: "AUTHORIZED", currentPeriodEnd: null } }), 100))
    );

    const user = userEvent.setup();
    render(<ReactivateButton />);

    const btn = screen.getByRole("button", { name: /reactivar pro/i });
    await act(async () => {
      await user.click(btn);
    });

    // Inmediatamente despues del click debe mostrar "Reactivando..."
    expect(screen.getByRole("button", { name: /reactivando/i })).toBeTruthy();
  });
});
