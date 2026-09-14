import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/actions/super-admin", () => ({
  deleteUser: mocks.deleteUser,
}));

import { AdminDeleteOwnerButton } from "../admin-delete-owner-button";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteUser.mockResolvedValue({ success: true });
});

async function openDialog() {
  const user = userEvent.setup();
  render(<AdminDeleteOwnerButton ownerId="owner-1" email="owner@test.com" hasSubscriptionHistory={false} />);
  await user.click(screen.getByRole("button", { name: /eliminar propietario/i }));
  const input = await screen.findByLabelText(/para confirmar/i);
  return { user, input, confirm: () => screen.getByRole("button", { name: /^eliminar$/i }) };
}

describe("AdminDeleteOwnerButton", () => {
  it("con historial de suscripción no ofrece el diálogo y explica por qué", async () => {
    const user = userEvent.setup();
    render(<AdminDeleteOwnerButton ownerId="owner-1" email="owner@test.com" hasSubscriptionHistory />);

    const button = screen.getByRole("button", { name: /eliminar propietario/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-describedby")).toBe("delete-owner-blocked");
    expect(screen.getByText(/tuvo una suscripción PRO/i).id).toBe("delete-owner-blocked");

    await user.click(button);
    expect(screen.queryByLabelText(/para confirmar/i)).toBeNull();
  });

  it("Eliminar queda deshabilitado hasta escribir el email exacto", async () => {
    const { user, input, confirm } = await openDialog();

    expect((confirm() as HTMLButtonElement).disabled).toBe(true);

    await user.type(input, "owner@test.co");
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);

    await user.type(input, "m");
    expect((confirm() as HTMLButtonElement).disabled).toBe(false);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("al confirmar elimina y vuelve a la lista", async () => {
    const { user, input, confirm } = await openDialog();

    await user.type(input, "owner@test.com");
    await user.click(confirm());

    await waitFor(() => {
      expect(mocks.deleteUser).toHaveBeenCalledWith("owner-1", "owner@test.com");
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Propietario eliminado");
    expect(mocks.push).toHaveBeenCalledWith("/admin/users");
  });

  it("si la acción devuelve error, lo muestra y se queda en la página", async () => {
    mocks.deleteUser.mockResolvedValueOnce({ error: "No se pudo eliminar el propietario" });
    const { user, input, confirm } = await openDialog();

    await user.type(input, "owner@test.com");
    await user.click(confirm());

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("No se pudo eliminar el propietario");
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("al cerrar el diálogo se descarta el email escrito", async () => {
    const { user, input } = await openDialog();

    await user.type(input, "owner@test.com");
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText(/para confirmar/i)).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: /eliminar propietario/i }));
    const reopened = (await screen.findByLabelText(/para confirmar/i)) as HTMLInputElement;
    expect(reopened.value).toBe("");
  });
});
