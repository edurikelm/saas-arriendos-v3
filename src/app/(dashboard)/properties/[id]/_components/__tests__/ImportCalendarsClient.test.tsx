import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/actions/external-calendars", () => ({
  createExternalCalendar: vi.fn(),
  deleteExternalCalendar: vi.fn(),
  syncExternalCalendar: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ImportCalendarsClient } from "../ImportCalendarsClient";

/**
 * Select REAL de Base UI, sin mock: lo que se prueba es justamente qué texto
 * pinta su disparador. `<SelectValue />` sin función hija mostraba el enum
 * ("AIRBNB", "BOOKING_COM") en vez de la etiqueta del canal.
 */
describe("ImportCalendarsClient — selector de canal", () => {
  async function abrirDialogo() {
    const user = userEvent.setup();
    render(<ImportCalendarsClient propertyId="prop-1" calendars={[]} />);
    await user.click(screen.getByRole("button", { name: /agregar calendario/i }));
    const disparador = await screen.findByRole("combobox", { name: "Canal" });
    return { user, disparador };
  }

  it("el disparador muestra la etiqueta del canal por defecto, no el enum", async () => {
    const { disparador } = await abrirDialogo();

    expect(disparador.textContent).toContain("Airbnb");
    expect(disparador.textContent).not.toContain("AIRBNB");
  });

  it("al elegir otro canal, el disparador pasa a su etiqueta", async () => {
    const { user, disparador } = await abrirDialogo();

    await user.click(disparador);
    await user.click(await screen.findByRole("option", { name: "Booking.com" }));

    await waitFor(() => expect(disparador.textContent).toContain("Booking.com"));
    expect(disparador.textContent).not.toContain("BOOKING_COM");
  });
});
