import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MercadoPagoSettings } from "../MercadoPagoSettings";

vi.mock("@/lib/actions/mercado-pago", () => ({
  getMercadoPagoIntegration: vi.fn(),
  saveMercadoPagoToken: vi.fn(),
  removeMercadoPagoToken: vi.fn(),
  getMercadoPagoOAuthStartUrl: vi.fn(),
}));

describe("MercadoPagoSettings", () => {
  it("hides manual token input when MP_MANUAL_TOKEN_ENABLED is false", async () => {
    const { getMercadoPagoIntegration } = await import("@/lib/actions/mercado-pago");
    vi.mocked(getMercadoPagoIntegration).mockResolvedValue({
      isConnected: false,
      hasToken: false,
      manualTokenEnabled: false,
      sandboxMode: false,
    });

    render(<MercadoPagoSettings />);

    await waitFor(() => {
      expect(screen.getByText("No conectado")).toBeDefined();
    });

    expect(screen.queryByLabelText("Access Token")).toBeNull();
    expect(screen.getByRole("button", { name: "Conectar con Mercado Pago" })).toBeDefined();
  });

  it("shows manual token input when MP_MANUAL_TOKEN_ENABLED is true", async () => {
    const { getMercadoPagoIntegration } = await import("@/lib/actions/mercado-pago");
    vi.mocked(getMercadoPagoIntegration).mockResolvedValue({
      isConnected: false,
      hasToken: false,
      manualTokenEnabled: true,
      sandboxMode: false,
    });

    render(<MercadoPagoSettings />);

    await waitFor(() => {
      expect(screen.getByLabelText("Access Token")).toBeDefined();
    });
  });

  it("shows config error message when oauth callback returns config_error", async () => {
    const { getMercadoPagoIntegration } = await import("@/lib/actions/mercado-pago");
    vi.mocked(getMercadoPagoIntegration).mockResolvedValue({
      isConnected: false,
      hasToken: false,
      manualTokenEnabled: false,
      sandboxMode: false,
    });

    render(<MercadoPagoSettings oauthStatus="config_error" />);

    await waitFor(() => {
      expect(screen.getByText(/Falta configuración OAuth/i)).toBeDefined();
    });
  });

  it("status pill uses rectangular radius (rounded-md), not pill radius", async () => {
    const { getMercadoPagoIntegration } = await import("@/lib/actions/mercado-pago");
    vi.mocked(getMercadoPagoIntegration).mockResolvedValue({
      isConnected: false,
      hasToken: false,
      manualTokenEnabled: false,
      sandboxMode: false,
    });

    const { container } = render(<MercadoPagoSettings />);

    await waitFor(() => {
      expect(screen.getByText("No conectado")).toBeDefined();
    });

    const notConnectedPill = screen.getByText("No conectado");
    const pillContainer = notConnectedPill.closest("span");
    expect(pillContainer).toBeTruthy();
    expect(pillContainer!.className).not.toMatch(/\brounded-full\b/);
    expect(pillContainer!.className).toMatch(/\brounded-md\b/);

    // Sanity-check the connected state too
    vi.mocked(getMercadoPagoIntegration).mockResolvedValue({
      isConnected: true,
      hasToken: true,
      manualTokenEnabled: false,
      sandboxMode: false,
    });
    const { container: connectedContainer, rerender } = render(<MercadoPagoSettings />);
    rerender(<MercadoPagoSettings key="re" />);
    await waitFor(() => {
      expect(screen.getAllByText("Conectado").length).toBeGreaterThan(0);
    });
    const connectedPill = Array.from(connectedContainer.querySelectorAll("span")).find(
      (el) => el.textContent === "Conectado" && el.classList.contains("inline-flex")
    );
    expect(connectedPill).toBeTruthy();
    expect(connectedPill!.className).not.toMatch(/\brounded-full\b/);
    expect(connectedPill!.className).toMatch(/\brounded-md\b/);
  });
});
