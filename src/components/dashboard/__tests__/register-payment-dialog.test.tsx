import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDateKeyInTz } from "@/lib/domain/timezone";
import { RegisterPaymentDialog } from "../register-payment-dialog";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const createPayment = vi.fn();
vi.mock("@/lib/actions/payments", () => ({
  createPayment: (...args: unknown[]) => (createPayment as (...a: unknown[]) => unknown)(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const defaultProps = {
  reservationId: "res-1",
  maxAmount: 500_000,
  contextLabel: "Juan Pérez · Depto Centro · Saldo del arriendo",
  open: true,
  onOpenChange: () => undefined,
};

describe("RegisterPaymentDialog", () => {
  beforeEach(() => {
    createPayment.mockReset();
    mockFetch.mockReset();
  });

  it("prellena el monto con el saldo, formateado con separador de miles", () => {
    render(<RegisterPaymentDialog {...defaultProps} />);

    const amountInput = screen.getByLabelText(/^monto$/i) as HTMLInputElement;
    expect(amountInput.value).toBe("500.000");
  });

  it("muestra el contextLabel como descripción del diálogo", () => {
    render(<RegisterPaymentDialog {...defaultProps} />);

    expect(screen.getByText("Juan Pérez · Depto Centro · Saldo del arriendo")).toBeTruthy();
  });

  it("rechaza un monto mayor al saldo, sin llamar al servidor", async () => {
    render(<RegisterPaymentDialog {...defaultProps} />);

    const amountInput = screen.getByLabelText(/^monto$/i);
    fireEvent.change(amountInput, { target: { value: "600000" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));

    expect(await screen.findByText(/no puede exceder el saldo/i)).toBeTruthy();
    expect(createPayment).not.toHaveBeenCalled();

    const invalidInput = screen.getByLabelText(/^monto$/i);
    expect(invalidInput.getAttribute("aria-invalid")).toBe("true");
    expect(invalidInput.getAttribute("aria-describedby")).toBe("register-payment-amount-error");
  });

  it("rechaza un monto en cero, sin llamar al servidor", async () => {
    render(<RegisterPaymentDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/^monto$/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));

    expect(await screen.findByText(/ingresa un monto válido/i)).toBeTruthy();
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("envía el payload exacto a createPayment", async () => {
    createPayment.mockResolvedValue({ success: true, payment: { id: "pay-1" } });

    render(<RegisterPaymentDialog {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/fecha de pago/i), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));

    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(1));

    const payload = createPayment.mock.calls[0][0];
    expect(payload).toMatchObject({
      reservationId: "res-1",
      amount: 500_000,
      method: "CASH",
      status: "COMPLETED",
      paymentType: "RESERVATION",
      // Mediodía de Santiago en horario de verano chileno.
      paidAt: "2026-10-01T15:00:00.000Z",
    });
    expect(payload.receiptUrl).toBeUndefined();
  });

  // El día de NEGOCIO del instante enviado, leído en Santiago y por día UTC,
  // con el navegador en distintas zonas. Con getters locales el test pasaría
  // siempre: el mediodía del navegador desde Sídney o Kiritimati ya es el día
  // anterior en Santiago (medido con TZ real).
  it.each(["America/Santiago", "Asia/Tokyo", "Europe/Madrid", "Australia/Sydney", "Pacific/Kiritimati"])(
    "con el navegador en %s, paidAt cae en el día elegido en Santiago y en UTC",
    async (tz) => {
      const original = process.env.TZ;
      process.env.TZ = tz;
      try {
        createPayment.mockResolvedValue({ success: true, payment: { id: "pay-1" } });

        render(<RegisterPaymentDialog {...defaultProps} />);

        fireEvent.change(screen.getByLabelText(/fecha de pago/i), { target: { value: "2026-10-01" } });
        fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));

        await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(1));

        const paidAt = new Date(createPayment.mock.calls[0][0].paidAt);
        expect(getDateKeyInTz(paidAt, "America/Santiago")).toBe("2026-10-01");
        expect(paidAt.toISOString().slice(0, 10)).toBe("2026-10-01");
      } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
      }
    },
  );

  it("llama onError cuando el servidor rechaza o falla la red, nunca onSuccess", async () => {
    const onError = vi.fn();
    const onSuccess = vi.fn();

    createPayment.mockResolvedValueOnce({ error: "El monto excede el total de la reserva" });
    const { unmount } = render(
      <RegisterPaymentDialog {...defaultProps} onError={onError} onSuccess={onSuccess} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    unmount();

    createPayment.mockRejectedValueOnce(new Error("fetch failed"));
    render(<RegisterPaymentDialog {...defaultProps} onError={onError} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(2));

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("el campo de comprobante tiene nombre accesible", () => {
    render(<RegisterPaymentDialog {...defaultProps} />);

    const input = screen.getByLabelText(/comprobante/i) as HTMLInputElement;
    expect(input.type).toBe("file");
  });

  it("sube el comprobante a /api/upload y lo incluye en el payload", async () => {
    createPayment.mockResolvedValue({ success: true, payment: { id: "pay-1" } });
    mockFetch.mockResolvedValue({
      json: async () => ({ url: "https://cloudinary.com/receipt.png" }),
    });

    render(<RegisterPaymentDialog {...defaultProps} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "receipt.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));

    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith("/api/upload", expect.objectContaining({ method: "POST" }));
    expect(createPayment.mock.calls[0][0].receiptUrl).toBe("https://cloudinary.com/receipt.png");
  });

  it("muestra un toast de error cuando el servidor rechaza el pago, sin cerrar el diálogo", async () => {
    createPayment.mockResolvedValue({ error: "El monto excede el total de la reserva" });
    const { toast } = await import("sonner");

    render(<RegisterPaymentDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("El monto excede el total de la reserva");
    });
  });

  // Un corte de red rechaza la server action en vez de devolver `error`: el
  // botón no puede quedar trabado en "Guardando..." sin que el dueño sepa si
  // el pago se registró.
  it("si la server action se rechaza, avisa y vuelve a habilitar el botón", async () => {
    createPayment.mockRejectedValue(new Error("fetch failed"));
    const { toast } = await import("sonner");

    render(<RegisterPaymentDialog {...defaultProps} />);

    const button = screen.getByRole("button", { name: /registrar pago/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "No se pudo registrar el pago. Revisa tu conexión e intenta de nuevo.",
      );
    });
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.textContent).toBe("Registrar pago");
  });

  it("al confirmar con éxito llama onSuccess y cierra el diálogo", async () => {
    createPayment.mockResolvedValue({ success: true, payment: { id: "pay-1" } });
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <RegisterPaymentDialog {...defaultProps} onSuccess={onSuccess} onOpenChange={onOpenChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: /registrar pago/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
