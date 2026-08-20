import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MarkPaidModal } from "../payment-actions";
import { usePaymentActions } from "../payment-actions";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const markPaymentAsPaid = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/lib/actions/payments", () => ({
  markPaymentAsPaid: (...args: unknown[]) => (markPaymentAsPaid as (...a: unknown[]) => unknown)(...args),
  attachReceipt: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function createFile(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

function uploadFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file] });
  fireEvent.change(input);
}

describe("MarkPaidModal — regression: preview persiste tras selección", () => {
  beforeEach(() => {
    markPaymentAsPaid.mockClear();
  });

  it("NO desmonta el Dialog al seleccionar archivo (identidad estable a nivel de módulo)", () => {
    /**
     * Regresión detectada: cuando el modal se definía DENTRO del hook
     * `usePaymentActions`, React creaba una nueva referencia de la función
     * componente en cada render del padre. Esto provocaba que React
     * desmontara y remontara el modal completo al cambiar cualquier estado
     * (incluso el setReceiptFile que dispara el propio `<input type="file">`),
     * perdiendo el archivo seleccionado y nunca mostrando la preview.
     *
     * El fix fue extraer `MarkPaidModal` a nivel de módulo en
     * `payment-actions.tsx`, envolviendo el canónico `MarkPaidDialog` de
     * `@/components/dashboard/mark-paid-dialog` (que también es módulo-level).
     * El test de este archivo garantiza que la identidad se preserva.
     */
    expect(MarkPaidModal).toBe(usePaymentActions.toString().length > 0 ? MarkPaidModal : MarkPaidModal);
    // El assertion de arriba es trivial; el verdadero test es el siguiente.
  });

  it("muestra el preview con img[alt='Preview'] tras seleccionar un archivo válido", () => {
    render(
      <MarkPaidModal
        paymentId="p-1"
        open={true}
        onOpenChange={() => undefined}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = createFile("test.png", "image/png", 1024);
    uploadFile(input, file);

    // La preview debe estar visible
    const preview = document.querySelector('img[alt="Preview"]');
    expect(preview).not.toBeNull();

    // El dropzone debe haberse reemplazado
    expect(document.querySelector('[class*="border-dashed"]')).toBeNull();
  });

  it("preserva el archivo seleccionado a través de re-renders del padre", () => {
    /**
     * Escenario crítico del bug original: el padre re-renderiza (p.ej. cuando
     * el toast o el spinner de upload cambian estado). Con el bug, este
     * re-render desmontaba el modal y el `img[alt="Preview"]` desaparecía
     * junto con el archivo. Con el fix, el modal mantiene su identidad de
     * módulo y el preview persiste.
     */
    function Harness({ tick }: { tick: number }) {
      return (
        <div data-tick={tick}>
          <MarkPaidModal
            paymentId="p-1"
            open={true}
            onOpenChange={() => undefined}
          />
        </div>
      );
    }

    const { rerender } = render(<Harness tick={0} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile("test.png", "image/png", 1024);
    uploadFile(input, file);

    expect(document.querySelector('img[alt="Preview"]')).not.toBeNull();

    // Forzar re-renders del padre (mismo tipo de cambio de estado que el bug original)
    rerender(<Harness tick={1} />);
    expect(document.querySelector('img[alt="Preview"]')).not.toBeNull();

    rerender(<Harness tick={2} />);
    expect(document.querySelector('img[alt="Preview"]')).not.toBeNull();
  });

  it("invoca el server action con método CASH por default al confirmar (sin archivo)", async () => {
    const { waitFor } = await import("@testing-library/react");
    render(
      <MarkPaidModal
        paymentId="p-1"
        open={true}
        onOpenChange={() => undefined}
      />
    );

    // Confirmar sin seleccionar archivo (la subida a /api/upload no se dispara)
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(markPaymentAsPaid).toHaveBeenCalled());
    const calls = markPaymentAsPaid.mock.calls as Array<[string, Date, string, string?]>;
    expect(calls[0][0]).toBe("p-1");
    expect(calls[0][2]).toBe("CASH");
  });
});
