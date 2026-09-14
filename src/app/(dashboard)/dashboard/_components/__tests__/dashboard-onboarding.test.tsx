import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardOnboarding } from "../dashboard-onboarding";

describe("DashboardOnboarding", () => {
  it("sin propiedades, el único llamado a la acción es agregar una", () => {
    render(<DashboardOnboarding hasProperties={false} />);

    const cta = screen.getByRole("link", { name: "Agregar propiedad" });
    expect(cta.getAttribute("href")).toBe("/properties/new");
    expect(screen.queryByRole("link", { name: "Crear reserva" })).toBeNull();
  });

  it("con propiedades, marca el primer paso como hecho y lleva a crear la reserva", () => {
    render(<DashboardOnboarding hasProperties />);

    expect(screen.getByText("Hecho:").classList.contains("sr-only")).toBe(true);
    expect(screen.queryByRole("link", { name: "Agregar propiedad" })).toBeNull();
    const cta = screen.getByRole("link", { name: "Crear reserva" });
    expect(cta.getAttribute("href")).toBe("/reservations?create=true");
  });
});
