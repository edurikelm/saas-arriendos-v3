import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  updateUserPlan: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/actions/super-admin", () => ({
  updateUserPlan: mocks.updateUserPlan,
}));

import { AdminOwnerPlanControl } from "../admin-owner-plan-control";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateUserPlan.mockResolvedValue({ success: true, user: {} });
});

describe("AdminOwnerPlanControl", () => {
  it("sin concesión ni suscripción: dice FREE y ofrece conceder", async () => {
    const user = userEvent.setup();
    render(<AdminOwnerPlanControl userId="owner-1" planOverride={null} subscriptionPlan="FREE" />);

    expect(screen.getByText("FREE")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /revocar/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /conceder pro/i }));

    await waitFor(() => {
      expect(mocks.updateUserPlan).toHaveBeenCalledWith({ userId: "owner-1", plan: "PRO" });
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("PRO concedido");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("con concesión: revocar manda FREE, que revoca y no fuerza FREE", async () => {
    const user = userEvent.setup();
    render(<AdminOwnerPlanControl userId="owner-1" planOverride="PRO" subscriptionPlan="FREE" />);

    expect(screen.getByText("PRO, concedido manualmente")).toBeTruthy();
    expect(screen.getByText("Si se revoca, vuelve a FREE.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /conceder/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /revocar pro/i }));

    await waitFor(() => {
      expect(mocks.updateUserPlan).toHaveBeenCalledWith({ userId: "owner-1", plan: "FREE" });
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Concesión de PRO revocada");
  });

  it("con concesión y suscripción que paga: avisa que revocar no le quita PRO", () => {
    render(<AdminOwnerPlanControl userId="owner-1" planOverride="PRO" subscriptionPlan="PRO" />);

    expect(screen.getByText("Si se revoca, sigue en PRO por su suscripción.")).toBeTruthy();
  });

  it("PRO por suscripción, sin concesión: lo dice y explica qué agregaría conceder", () => {
    render(<AdminOwnerPlanControl userId="owner-1" planOverride={null} subscriptionPlan="PRO" />);

    expect(screen.getByText("PRO, por su suscripción")).toBeTruthy();
    expect(
      screen.getByText("Conceder PRO lo mantiene en PRO aunque su suscripción termine."),
    ).toBeTruthy();
  });

  it("si la acción devuelve error, lo muestra y no refresca", async () => {
    const user = userEvent.setup();
    mocks.updateUserPlan.mockResolvedValueOnce({ error: "No autorizado" });
    render(<AdminOwnerPlanControl userId="owner-1" planOverride={null} subscriptionPlan="FREE" />);

    await user.click(screen.getByRole("button", { name: /conceder pro/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("No autorizado");
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
