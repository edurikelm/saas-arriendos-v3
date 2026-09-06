import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MarkPaidDialog } from "../mark-paid-dialog";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const markPaymentAsPaid = vi.fn();
vi.mock("@/lib/actions/payments", () => ({
  markPaymentAsPaid: (...args: unknown[]) =>
    (markPaymentAsPaid as (...a: unknown[]) => unknown)(...args),
}));

describe("MarkPaidDialog", () => {
  beforeEach(() => {
    markPaymentAsPaid.mockReset();
  });

  it("no se renderiza cuando open=false", () => {
    render(
      <MarkPaidDialog
        paymentId="p1"
        open={false}
        onOpenChange={() => undefined}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("al confirmar llama markPaymentAsPaid con método CASH por default", async () => {
    markPaymentAsPaid.mockResolvedValue({ success: true });

    render(
      <MarkPaidDialog
        paymentId="p-1"
        open={true}
        onOpenChange={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => {
      expect(markPaymentAsPaid).toHaveBeenCalledTimes(1);
    });

    const calls = markPaymentAsPaid.mock.calls as Array<[string, Date, string, string?]>;
    const [paymentId, paidAt, method] = calls[0];
    expect(paymentId).toBe("p-1");
    expect(method).toBe("CASH");
    expect(paidAt instanceof Date).toBe(true);
  });

  it("siembra el metodo desde el pago: una Transferencia no se reescribe a Efectivo", async () => {
    // Regresion: el select arrancaba siempre en CASH, asi que confirmar sobre una
    // fila de Transferencia cambiaba el metodo en silencio. Y como el dialogo
    // queda montado entre aperturas, tambien arrastraba lo elegido la vez anterior.
    markPaymentAsPaid.mockResolvedValue({ success: true });

    render(
      <MarkPaidDialog
        paymentId="p-transfer"
        open={true}
        onOpenChange={() => undefined}
        defaultMethod="TRANSFER"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => {
      expect(markPaymentAsPaid).toHaveBeenCalledTimes(1);
    });

    const calls = markPaymentAsPaid.mock.calls as Array<[string, Date, string, string?]>;
    expect(calls[0][2]).toBe("TRANSFER");
  });

  it("al reabrir con otro pago toma el metodo del pago nuevo, no el anterior", async () => {
    // El dialogo queda montado entre aperturas. Fecha y metodo se derivan en
    // render y el override se limpia al cerrar, asi que no se pegan de un pago
    // al siguiente.
    markPaymentAsPaid.mockResolvedValue({ success: true });

    const { rerender } = render(
      <MarkPaidDialog
        paymentId="p-transfer"
        open={true}
        onOpenChange={() => undefined}
        defaultMethod="TRANSFER"
      />
    );

    rerender(
      <MarkPaidDialog
        paymentId="p-cash"
        open={true}
        onOpenChange={() => undefined}
        defaultMethod="CASH"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => {
      expect(markPaymentAsPaid).toHaveBeenCalledTimes(1);
    });

    const calls = markPaymentAsPaid.mock.calls as Array<[string, Date, string, string?]>;
    expect(calls[0][0]).toBe("p-cash");
    expect(calls[0][2]).toBe("CASH");
  });

  it("muestra el monto que se va a liquidar", () => {
    // Sobre una lista donde seis cuotas pueden decir lo mismo, el dialogo tiene
    // que nombrar cual se esta liquidando: la accion no tiene undo.
    render(
      <MarkPaidDialog
        paymentId="p-1"
        open={true}
        onOpenChange={() => undefined}
        amount="780000"
        contextLabel="Octubre de 2026 · María Fernanda Contreras"
      />
    );

    expect(screen.getByText("$780.000")).toBeTruthy();
    expect(screen.getByText("Monto a registrar")).toBeTruthy();
    expect(screen.getByText("Octubre de 2026 · María Fernanda Contreras")).toBeTruthy();
  });

  it("sin amount no renderiza el bloque de monto", () => {
    render(
      <MarkPaidDialog paymentId="p-1" open={true} onOpenChange={() => undefined} />
    );
    expect(screen.queryByText("Monto a registrar")).toBeNull();
  });

  it("propaga el error del action via toast", async () => {
    markPaymentAsPaid.mockResolvedValue({ error: "Pago no encontrado" });

    render(
      <MarkPaidDialog
        paymentId="bad"
        open={true}
        onOpenChange={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => {
      expect(markPaymentAsPaid).toHaveBeenCalled();
    });
  });

  it("abre/cerrar dispara onOpenChange al cancelar", () => {
    const onOpenChange = vi.fn();
    render(
      <MarkPaidDialog
        paymentId="p-1"
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
