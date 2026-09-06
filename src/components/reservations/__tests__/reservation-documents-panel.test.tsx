import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReservationDocumentsPanel } from "../reservation-documents-panel";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockDocument = {
  id: "doc-1",
  category: "CONTRATO" as const,
  documentType: "PDF" as const,
  fileName: "contrato-arriendo-marzo.pdf",
  fileSize: 204800,
};

async function renderWithDocuments() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ documents: [mockDocument] }),
  });
  render(<ReservationDocumentsPanel reservationId="res-1" />);
  await waitFor(() => expect(screen.getByText(mockDocument.fileName)).toBeTruthy());
}

// El borrado de documentos es la contraparte P1 de "Eliminar pago": a
// diferencia de pagos (soft delete + restore endpoint), reservation-documents
// no tiene NINGÚN endpoint de restauración (solo GET y DELETE en
// /api/reservation-documents/[id]/route.ts) — así que la única guarda posible
// es ConfirmDialog SIN promesa de undo. Este test fija que el DELETE nunca se
// dispara sin pasar primero por la confirmación.
describe("ReservationDocumentsPanel — guarda de borrado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("abrir el menú y click en 'Eliminar' NO dispara el DELETE de inmediato", async () => {
    const user = userEvent.setup();
    await renderWithDocuments();

    await user.click(
      screen.getByRole("button", { name: `Más acciones para ${mockDocument.fileName}` }),
    );
    await user.click(await screen.findByText("Eliminar"));

    // El diálogo de confirmación debe aparecer y nombrar el documento.
    expect(await screen.findByRole("heading", { name: "Eliminar documento" })).toBeTruthy();
    expect(
      screen.getByText((_, node) => node?.textContent === `El documento "${mockDocument.fileName}" se eliminará de la reserva. La acción es permanente: no hay forma de recuperarlo después.`),
    ).toBeTruthy();

    // Ningún DELETE debe haber salido todavía — solo el GET inicial de carga.
    const deleteCalls = mockFetch.mock.calls.filter(([, init]) => init?.method === "DELETE");
    expect(deleteCalls).toHaveLength(0);
  });

  it("confirmar en el diálogo SÍ dispara el DELETE contra el documento correcto", async () => {
    const user = userEvent.setup();
    await renderWithDocuments();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ documents: [] }) });

    await user.click(
      screen.getByRole("button", { name: `Más acciones para ${mockDocument.fileName}` }),
    );
    await user.click(await screen.findByText("Eliminar"));
    await screen.findByRole("heading", { name: "Eliminar documento" });

    await user.click(screen.getByRole("button", { name: "Eliminar documento" }));

    await waitFor(() => {
      const deleteCalls = mockFetch.mock.calls.filter(([, init]) => init?.method === "DELETE");
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0][0]).toBe(`/api/reservation-documents/${mockDocument.id}`);
    });
  });

  it("cancelar el diálogo tampoco dispara el DELETE", async () => {
    const user = userEvent.setup();
    await renderWithDocuments();

    await user.click(
      screen.getByRole("button", { name: `Más acciones para ${mockDocument.fileName}` }),
    );
    await user.click(await screen.findByText("Eliminar"));
    await screen.findByRole("heading", { name: "Eliminar documento" });

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByText("Eliminar documento")).toBeNull());
    const deleteCalls = mockFetch.mock.calls.filter(([, init]) => init?.method === "DELETE");
    expect(deleteCalls).toHaveLength(0);
  });
});
