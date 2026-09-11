import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SendPaymentLinkDialog } from "../send-payment-link-dialog";

/**
 * El diálogo lo consumen el detalle de reserva y, desde ahora, `/payments`.
 * En pagos reemplazó a `navigator.share`, que en escritorio no existe en Chrome
 * ni en Firefox: el botón decía "Enviar link" y lo que pasaba era una copia
 * silenciosa de la URL sola, sin monto ni nombre.
 */
const payment = {
  id: "pay-1",
  amount: "450000",
  status: "PENDING",
  method: "MERCADO_PAGO",
  initPoint: "https://mp.com/checkout/abc",
  dueDate: "2026-09-20T15:00:00Z",
  installmentIndex: 3,
  title: null,
};

const client = {
  name: "María Fernanda González",
  email: "maria@example.com",
  phone: "+56 9 1234 5678",
};

function renderDialog(overrides: { client?: Partial<typeof client> } = {}) {
  render(
    <SendPaymentLinkDialog
      open
      onOpenChange={vi.fn()}
      payment={payment}
      client={{ ...client, ...overrides.client }}
      propertyName="Depto Providencia 1204"
      billingType="MONTHLY"
    />,
  );
  return screen.getByRole("textbox") as HTMLTextAreaElement;
}

describe("SendPaymentLinkDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("el mensaje trae lo que hace entendible el cobro al recibirlo", () => {
    const mensaje = renderDialog();

    expect(mensaje.value).toContain("María Fernanda González");
    expect(mensaje.value).toContain("Depto Providencia 1204");
    expect(mensaje.value).toContain("$450.000");
    expect(mensaje.value).toContain("https://mp.com/checkout/abc");
  });

  it("nombra la cuota en un arriendo mensual", () => {
    expect(renderDialog().value).toContain("Cuota 3");
  });

  it("ofrece WhatsApp y correo", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: /whatsapp/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /email/i })).toBeTruthy();
  });

  it("deshabilita WhatsApp cuando el cliente no tiene teléfono", () => {
    // `phone` es opcional en el modelo, así que este caso llega de verdad.
    renderDialog({ client: { phone: undefined } });

    expect(screen.getByRole("button", { name: /whatsapp/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /email/i }).hasAttribute("disabled")).toBe(false);
  });

  it("el mensaje es editable antes de enviarlo", () => {
    const mensaje = renderDialog();

    expect(mensaje.readOnly).toBe(false);
    expect(mensaje.disabled).toBe(false);
  });
});
