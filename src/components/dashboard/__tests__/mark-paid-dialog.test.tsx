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
