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
});
