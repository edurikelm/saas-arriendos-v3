import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DashboardNextCharge } from "@/lib/dashboard/summary";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const generateMercadoPagoLink = vi.fn();
const generatePaymentLink = vi.fn();
const regeneratePaymentLink = vi.fn();
const markPaymentAsPaid = vi.fn();
const createPayment = vi.fn();
vi.mock("@/lib/actions/payments", () => ({
  generateMercadoPagoLink: (...a: unknown[]) => generateMercadoPagoLink(...a),
  generatePaymentLink: (...a: unknown[]) => generatePaymentLink(...a),
  regeneratePaymentLink: (...a: unknown[]) => regeneratePaymentLink(...a),
  markPaymentAsPaid: (...a: unknown[]) => markPaymentAsPaid(...a),
  createPayment: (...a: unknown[]) => createPayment(...a),
}));

import { CobranzaRowActions } from "../cobranza-row-actions";

const baseProps = {
  reservationId: "res-1",
  clientName: "Juan Pérez",
  clientEmail: "juan@test.com",
  clientPhone: "+56912345678",
  propertyName: "Depto Centro",
  billingType: "DAILY" as const,
};

function existingCharge(
  overrides: Partial<Extract<DashboardNextCharge, { kind: "EXISTING" }>> = {},
): DashboardNextCharge {
  return {
    kind: "EXISTING",
    paymentId: "pay-1",
    paymentType: "RESERVATION",
    status: "PENDING",
    amount: 100_000,
    method: "MERCADO_PAGO",
    installmentIndex: null,
    installmentCount: null,
    dueDate: null,
    title: null,
    initPoint: null,
    expiresAt: null,
    ...overrides,
  };
}

const NEW_CHARGE: DashboardNextCharge = { kind: "NEW", amount: 50_000 };
const VENCIDO = "2020-01-01T00:00:00.000Z";
const VIGENTE = "2999-01-01T00:00:00.000Z";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CobranzaRowActions — presencia de botones", () => {
  it("sin nextCharge no renderiza nada", () => {
    const { container } = render(
      <CobranzaRowActions {...baseProps} nextCharge={null} canSendPaymentLinks />,
    );
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("'Registrar pago' aparece con EXISTING y con NEW, sin canSendPaymentLinks", () => {
    const { rerender } = render(
      <CobranzaRowActions {...baseProps} nextCharge={existingCharge()} />,
    );
    expect(screen.getByRole("button", { name: /registrar pago de juan pérez/i })).toBeTruthy();

    rerender(<CobranzaRowActions {...baseProps} nextCharge={NEW_CHARGE} />);
    expect(screen.getByRole("button", { name: /registrar pago de juan pérez/i })).toBeTruthy();
  });

  it("sin canSendPaymentLinks nunca muestra 'Enviar link', aunque el cobro sea elegible", () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ status: "PENDING", initPoint: "https://mp.com/x" })}
        canSendPaymentLinks={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /enviar link/i })).toBeNull();
  });

  it("con canSendPaymentLinks y NEW, muestra 'Enviar link'", () => {
    render(<CobranzaRowActions {...baseProps} nextCharge={NEW_CHARGE} canSendPaymentLinks />);
    expect(screen.getByRole("button", { name: /enviar link de pago a juan pérez/i })).toBeTruthy();
  });

  it("con canSendPaymentLinks y method CASH/TRANSFER, no muestra 'Enviar link'", () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ method: "CASH", initPoint: null })}
        canSendPaymentLinks
      />,
    );
    expect(screen.queryByRole("button", { name: /enviar link/i })).toBeNull();
  });

  it("con canSendPaymentLinks y FAILED con link vigente, NO muestra 'Enviar link' (único excluido)", () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ status: "FAILED", initPoint: "https://mp.com/x", expiresAt: VIGENTE })}
        canSendPaymentLinks
      />,
    );
    expect(screen.queryByRole("button", { name: /enviar link/i })).toBeNull();
  });

  it("con canSendPaymentLinks y FAILED sin link, sí muestra 'Enviar link'", () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ status: "FAILED", initPoint: null })}
        canSendPaymentLinks
      />,
    );
    expect(screen.getByRole("button", { name: /enviar link/i })).toBeTruthy();
  });

  it("con canSendPaymentLinks y PENDING con link vencido, sí muestra 'Enviar link'", () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ status: "PENDING", initPoint: "https://mp.com/x", expiresAt: VENCIDO })}
        canSendPaymentLinks
      />,
    );
    expect(screen.getByRole("button", { name: /enviar link/i })).toBeTruthy();
  });
});

describe("CobranzaRowActions — Registrar pago", () => {
  // La fila vieja es el caso típico de rechazo: el pago ya se completó en otra
  // pestaña. Sin refrescar, cada reintento repetiría el mismo error.
  it("si el servidor rechaza, refresca la fila igual que en éxito", async () => {
    markPaymentAsPaid.mockResolvedValue({ error: "El pago ya está completado" });

    render(<CobranzaRowActions {...baseProps} nextCharge={existingCharge()} />);

    fireEvent.click(screen.getByRole("button", { name: /registrar pago de juan pérez/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(markPaymentAsPaid).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  it("con EXISTING abre MarkPaidDialog con el contextLabel de Arriendo (sin cuota)", async () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ installmentIndex: null, paymentType: "RESERVATION" })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /registrar pago de juan pérez/i }));

    expect(await screen.findByText("Juan Pérez · Depto Centro · Arriendo")).toBeTruthy();
  });

  it("con installmentIndex e installmentCount, el contextLabel dice 'Cuota N de M'", async () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ installmentIndex: 2, installmentCount: 3 })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /registrar pago de juan pérez/i }));

    expect(await screen.findByText("Juan Pérez · Depto Centro · Cuota 2 de 3")).toBeTruthy();
  });

  it("con installmentIndex sin installmentCount, el contextLabel dice solo 'Cuota N'", async () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ installmentIndex: 2, installmentCount: null })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /registrar pago de juan pérez/i }));

    expect(await screen.findByText("Juan Pérez · Depto Centro · Cuota 2")).toBeTruthy();
  });

  it("con EXTRA y título, el contextLabel usa el título del cobro", async () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ paymentType: "EXTRA", title: "Limpieza extra", installmentIndex: null })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /registrar pago de juan pérez/i }));

    expect(await screen.findByText("Juan Pérez · Depto Centro · Limpieza extra")).toBeTruthy();
  });

  it("con EXTRA sin título, el contextLabel dice 'Cobro extra'", async () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ paymentType: "EXTRA", title: null, installmentIndex: null })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /registrar pago de juan pérez/i }));

    expect(await screen.findByText("Juan Pérez · Depto Centro · Cobro extra")).toBeTruthy();
  });

  it("con NEW abre RegisterPaymentDialog con 'Saldo del arriendo' y el maxAmount del saldo", async () => {
    render(<CobranzaRowActions {...baseProps} nextCharge={{ kind: "NEW", amount: 250_000 }} />);

    fireEvent.click(screen.getByRole("button", { name: /registrar pago de juan pérez/i }));

    expect(await screen.findByText("Juan Pérez · Depto Centro · Saldo del arriendo")).toBeTruthy();
    const amountInput = (await screen.findByLabelText(/^monto$/i)) as HTMLInputElement;
    expect(amountInput.value).toBe("250.000");
  });

  it("muestra el notice de doble cobro cuando el método es MP y el link sigue vigente", async () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ method: "MERCADO_PAGO", initPoint: "https://mp.com/x", expiresAt: VIGENTE })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /registrar pago de juan pérez/i }));

    expect(await screen.findByText(/se cobra dos veces/i)).toBeTruthy();
  });

  it("no muestra el notice cuando el link de MP ya venció", async () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ method: "MERCADO_PAGO", initPoint: "https://mp.com/x", expiresAt: VENCIDO })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /registrar pago de juan pérez/i }));

    // Espera a que el diálogo monte (mismo contextLabel de siempre) antes de
    // afirmar la ausencia del notice.
    await screen.findByText("Juan Pérez · Depto Centro · Arriendo");
    expect(screen.queryByText(/se cobra dos veces/i)).toBeNull();
  });

  it("no muestra el notice para un cobro en efectivo/transferencia", async () => {
    render(
      <CobranzaRowActions {...baseProps} nextCharge={existingCharge({ method: "CASH" })} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /registrar pago de juan pérez/i }));

    await screen.findByText("Juan Pérez · Depto Centro · Arriendo");
    expect(screen.queryByText(/se cobra dos veces/i)).toBeNull();
  });
});

describe("CobranzaRowActions — Enviar link", () => {
  it("PENDING con link vigente: abre el diálogo directo, sin llamar a ninguna server action", async () => {
    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ status: "PENDING", initPoint: "https://mp.com/vigente", expiresAt: VIGENTE })}
        canSendPaymentLinks
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /enviar link de pago a juan pérez/i }));

    expect(await screen.findByText("Enviar link de pago")).toBeTruthy();
    expect(generateMercadoPagoLink).not.toHaveBeenCalled();
    expect(generatePaymentLink).not.toHaveBeenCalled();
    expect(regeneratePaymentLink).not.toHaveBeenCalled();
  });

  it("PENDING sin link: llama generatePaymentLink y abre el diálogo con el initPoint devuelto", async () => {
    generatePaymentLink.mockResolvedValue({ success: true, initPoint: "https://mp.com/nuevo" });

    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ status: "PENDING", initPoint: null, paymentId: "pay-9" })}
        canSendPaymentLinks
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /enviar link de pago a juan pérez/i }));

    await waitFor(() => expect(generatePaymentLink).toHaveBeenCalledWith("pay-9"));
    expect(regeneratePaymentLink).not.toHaveBeenCalled();
    expect(generateMercadoPagoLink).not.toHaveBeenCalled();
    expect(await screen.findByText("Enviar link de pago")).toBeTruthy();
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("PENDING con link vencido: llama regeneratePaymentLink, no generatePaymentLink", async () => {
    regeneratePaymentLink.mockResolvedValue({ success: true, initPoint: "https://mp.com/regenerado" });

    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({
          status: "PENDING",
          initPoint: "https://mp.com/viejo",
          expiresAt: VENCIDO,
          paymentId: "pay-8",
        })}
        canSendPaymentLinks
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /enviar link de pago a juan pérez/i }));

    await waitFor(() => expect(regeneratePaymentLink).toHaveBeenCalledWith("pay-8"));
    expect(generatePaymentLink).not.toHaveBeenCalled();
    expect(await screen.findByText("Enviar link de pago")).toBeTruthy();
  });

  it("FAILED sin link: llama regeneratePaymentLink", async () => {
    regeneratePaymentLink.mockResolvedValue({ success: true, initPoint: "https://mp.com/regenerado" });

    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ status: "FAILED", initPoint: null, paymentId: "pay-7" })}
        canSendPaymentLinks
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /enviar link de pago a juan pérez/i }));

    await waitFor(() => expect(regeneratePaymentLink).toHaveBeenCalledWith("pay-7"));
    expect(await screen.findByText("Enviar link de pago")).toBeTruthy();
  });

  it("NEW: llama generateMercadoPagoLink(reservationId) sin monto y abre el diálogo", async () => {
    generateMercadoPagoLink.mockResolvedValue({
      success: true,
      payment: { id: "pay-new", amount: "250000" },
      initPoint: "https://mp.com/nuevo-saldo",
    });

    render(<CobranzaRowActions {...baseProps} nextCharge={NEW_CHARGE} canSendPaymentLinks />);

    fireEvent.click(screen.getByRole("button", { name: /enviar link de pago a juan pérez/i }));

    await waitFor(() => expect(generateMercadoPagoLink).toHaveBeenCalledWith("res-1"));
    expect(await screen.findByText("Enviar link de pago")).toBeTruthy();
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("en error: toast.error, el diálogo NO se abre, y router.refresh igual se llama", async () => {
    generatePaymentLink.mockResolvedValue({ error: "Conecta tu cuenta de Mercado Pago" });
    const { toast } = await import("sonner");

    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ status: "PENDING", initPoint: null })}
        canSendPaymentLinks
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /enviar link de pago a juan pérez/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Conecta tu cuenta de Mercado Pago");
    });
    expect(screen.queryByText("Enviar link de pago")).toBeNull();
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("deshabilita el botón mientras la acción está en curso", async () => {
    let resolvePromise: (value: unknown) => void = () => undefined;
    generatePaymentLink.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    render(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({ status: "PENDING", initPoint: null })}
        canSendPaymentLinks
      />,
    );

    const button = screen.getByRole("button", { name: /enviar link de pago a juan pérez/i });
    fireEvent.click(button);

    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));

    resolvePromise({ success: true, initPoint: "https://mp.com/ok" });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  });

  // Entre que el servidor crea el link y llega el refresh, la fila sigue viendo
  // NEW. Volver a pulsar en esa ventana no puede crear un segundo pago PENDING
  // por el mismo saldo: `generateMercadoPagoLink` no revisa si ya hay uno.
  it("NEW: un segundo clic antes del refresh reabre el link creado, sin generar otro", async () => {
    generateMercadoPagoLink.mockResolvedValue({
      success: true,
      payment: { id: "pay-new", amount: "250000" },
      initPoint: "https://mp.com/nuevo-saldo",
    });

    render(<CobranzaRowActions {...baseProps} nextCharge={NEW_CHARGE} canSendPaymentLinks />);

    const button = screen.getByRole("button", { name: /enviar link de pago a juan pérez/i });
    fireEvent.click(button);
    expect(await screen.findByText("Enviar link de pago")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByText("Enviar link de pago")).toBeNull());

    fireEvent.click(button);
    expect(await screen.findByText("Enviar link de pago")).toBeTruthy();
    expect(generateMercadoPagoLink).toHaveBeenCalledTimes(1);
    const message = screen.getByLabelText("Mensaje") as HTMLTextAreaElement;
    expect(message.value).toContain("https://mp.com/nuevo-saldo");
  });

  // El recuerdo es por cobro, no para siempre: si la fila pasa a otro cobro y
  // vuelve a NEW (el pago creado se borró en otra pestaña), reabrir el link
  // viejo mandaría el de un cobro que ya no existe.
  it("si el cobro de la fila cambia de identidad, el link recordado se descarta", async () => {
    generateMercadoPagoLink.mockResolvedValue({
      success: true,
      payment: { id: "pay-new", amount: "250000" },
      initPoint: "https://mp.com/nuevo-saldo",
    });

    const { rerender } = render(
      <CobranzaRowActions {...baseProps} nextCharge={NEW_CHARGE} canSendPaymentLinks />,
    );

    const button = screen.getByRole("button", { name: /enviar link de pago a juan pérez/i });
    fireEvent.click(button);
    expect(await screen.findByText("Enviar link de pago")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByText("Enviar link de pago")).toBeNull());

    // Llega el refresh: la fila ya ve el pago creado.
    rerender(
      <CobranzaRowActions
        {...baseProps}
        nextCharge={existingCharge({
          paymentId: "pay-new",
          initPoint: "https://mp.com/nuevo-saldo",
          expiresAt: VIGENTE,
        })}
        canSendPaymentLinks
      />,
    );
    // Ese pago se borra en otra pestaña: la fila vuelve a ver el saldo sin cobro.
    rerender(<CobranzaRowActions {...baseProps} nextCharge={NEW_CHARGE} canSendPaymentLinks />);

    fireEvent.click(screen.getByRole("button", { name: /enviar link de pago a juan pérez/i }));
    await waitFor(() => expect(generateMercadoPagoLink).toHaveBeenCalledTimes(2));
  });
});
