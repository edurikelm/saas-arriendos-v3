import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminOwnerNotes } from "../admin-owner-notes";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const makeNote = (overrides: Partial<{
  id: string;
  adminId: string;
  ownerId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  admin: { id: string; name: string | null; email: string };
}> = {}) => ({
  id: "note-1",
  adminId: "admin-1",
  ownerId: "owner-1",
  content: "Cliente importante, llamar antes de renovar",
  createdAt: "2026-07-10T14:30:00Z",
  updatedAt: "2026-07-10T14:30:00Z",
  admin: { id: "admin-1", name: "Admin User", email: "admin@test.com" },
  ...overrides,
});

const mockFetchOk = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);

const mockFetchError = (status: number, errorMessage: string) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: errorMessage }),
  } as Response);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminOwnerNotes", () => {
  // ── Carga inicial ──────────────────────────────────────
  it("muestra estado de carga mientras se cargan las notas", () => {
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise(() => {}) as never
    );

    const { container } = render(<AdminOwnerNotes ownerId="owner-1" />);

    // Loader2 spinner presente
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.getByText("Notas internas")).toBeTruthy();
  });

  it("carga y muestra notas del owner", async () => {
    const notes = [
      makeNote({ id: "note-1", content: "Primera nota" }),
      makeNote({ id: "note-2", content: "Segunda nota", admin: { id: "admin-2", name: "Otro Admin", email: "otro@test.com" } }),
    ];
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk(notes) as never);

    render(<AdminOwnerNotes ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("Primera nota")).toBeTruthy();
    });
    expect(screen.getByText("Segunda nota")).toBeTruthy();
    expect(screen.getByText(/2 notas/)).toBeTruthy();

    // Verifica que se llamó al endpoint correcto
    expect(fetchSpy).toHaveBeenCalledWith("/api/admin/notes?ownerId=owner-1");
  });

  it("muestra estado vacío si no hay notas", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([]) as never);

    render(<AdminOwnerNotes ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText(/No hay notas internas/i)).toBeTruthy();
    });
  });

  it("muestra error si falla la carga inicial", async () => {
    const { toast } = await import("sonner");
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    render(<AdminOwnerNotes ownerId="owner-1" />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Error de conexión");
    });
  });

  // ── Crear nota ──────────────────────────────────────
  it("crea una nota nueva y la agrega al inicio de la lista", async () => {
    const user = userEvent.setup();
    const existingNote = makeNote({ id: "note-1", content: "Existente" });
    const newNote = makeNote({ id: "note-2", content: "Nota nueva" });

    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockFetchOk([existingNote]) as never) // GET inicial
      .mockResolvedValueOnce(mockFetchOk(newNote) as never); // POST create

    render(<AdminOwnerNotes ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("Existente")).toBeTruthy();
    });

    const textarea = screen.getByPlaceholderText(/Agregar una nota interna/i);
    await user.type(textarea, "Nota nueva");

    const submitBtn = screen.getByRole("button", { name: /agregar nota/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Nota nueva")).toBeTruthy();
    });

    // Verifica que se hizo POST con body correcto
    const postCall = fetchSpy.mock.calls[1];
    expect(postCall[0]).toBe("/api/admin/notes");
    expect((postCall[1] as RequestInit).method).toBe("POST");
    const body = JSON.parse((postCall[1] as RequestInit).body as string);
    expect(body.ownerId).toBe("owner-1");
    expect(body.content).toBe("Nota nueva");
  });

  it("no permite crear nota vacía", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([]) as never);

    render(<AdminOwnerNotes ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Agregar una nota interna/i)).toBeTruthy();
    });

    const submitBtn = screen.getByRole("button", { name: /agregar nota/i }) as HTMLButtonElement;
    // Botón deshabilitado con textarea vacío
    expect(submitBtn.disabled).toBe(true);

    // Intentar forzar con type + clear para verificar que no se llama
    const textarea = screen.getByPlaceholderText(/Agregar una nota interna/i);
    await user.type(textarea, "x");
    await user.clear(textarea);

    expect(submitBtn.disabled).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("muestra error si falla la creación", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockFetchOk([]) as never)
      .mockResolvedValueOnce(mockFetchError(400, "Contenido inválido") as never);

    render(<AdminOwnerNotes ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Agregar una nota interna/i)).toBeTruthy();
    });

    const textarea = screen.getByPlaceholderText(/Agregar una nota interna/i);
    await user.type(textarea, "Nota mala");

    await user.click(screen.getByRole("button", { name: /agregar nota/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Contenido inválido");
    });
  });

  // ── Eliminar nota ──────────────────────────────────────
  it("elimina una nota y la remueve de la lista", async () => {
    const user = userEvent.setup();
    const note1 = makeNote({ id: "note-1", content: "A eliminar" });
    const note2 = makeNote({ id: "note-2", content: "A mantener" });

    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockFetchOk([note1, note2]) as never) // GET inicial
      .mockResolvedValueOnce(mockFetchOk({}) as never); // DELETE

    render(<AdminOwnerNotes ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("A eliminar")).toBeTruthy();
      expect(screen.getByText("A mantener")).toBeTruthy();
    });

    // Click en el botón eliminar (Trash2) de la primera nota
    const noteContainer = screen.getByText("A eliminar").closest(".p-4") as HTMLElement;
    const deleteBtn = within(noteContainer).getByRole("button");
    await user.click(deleteBtn);

    // ConfirmDialog aparece
    await waitFor(() => {
      expect(screen.getByText(/¿Estás seguro/i)).toBeTruthy();
    });

    // Click en Eliminar del ConfirmDialog
    const confirmBtn = screen.getByRole("button", { name: /^eliminar$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByText("A eliminar")).toBeNull();
    });
    expect(screen.getByText("A mantener")).toBeTruthy();

    // Verifica DELETE call
    const deleteCall = fetchSpy.mock.calls[1];
    expect(deleteCall[0]).toBe("/api/admin/notes?noteId=note-1");
    expect((deleteCall[1] as RequestInit).method).toBe("DELETE");
  });

  it("muestra error si falla la eliminación", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    const note = makeNote({ id: "note-1", content: "Test" });

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockFetchOk([note]) as never)
      .mockResolvedValueOnce(mockFetchError(500, "Server error") as never);

    render(<AdminOwnerNotes ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("Test")).toBeTruthy();
    });

    const noteContainer = screen.getByText("Test").closest(".p-4") as HTMLElement;
    const deleteBtn = within(noteContainer).getByRole("button");
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText(/¿Estás seguro/i)).toBeTruthy();
    });

    const confirmBtn = screen.getByRole("button", { name: /^eliminar$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });

  // ── Initials ──────────────────────────────────────
  it("muestra iniciales del admin en el avatar", async () => {
    const note = makeNote({
      admin: { id: "admin-1", name: "Juan Pérez", email: "juan@test.com" },
    });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([note]) as never);

    render(<AdminOwnerNotes ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("JP")).toBeTruthy();
    });
  });

  it("usa iniciales del email si no hay nombre", async () => {
    const note = makeNote({
      admin: { id: "admin-1", name: null, email: "carlos.rodriguez@test.com" },
    });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([note]) as never);

    render(<AdminOwnerNotes ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("CA")).toBeTruthy();
    });
  });
});
