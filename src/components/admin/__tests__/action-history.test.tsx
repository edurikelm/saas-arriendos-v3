import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ActionHistory } from "../action-history";

const makeLog = (overrides: Partial<{
  id: string;
  adminId: string;
  targetId: string;
  action: string;
  details: string | null;
  createdAt: string;
  admin: { id: string; name: string | null; email: string };
}> = {}) => ({
  id: "log-1",
  adminId: "admin-1",
  targetId: "owner-1",
  action: "PLAN_CHANGED",
  details: JSON.stringify({ before: "FREE", after: "PRO" }),
  createdAt: "2026-07-10T14:30:00Z",
  admin: { id: "admin-1", name: "Admin User", email: "admin@test.com" },
  ...overrides,
});

const mockFetchOk = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ActionHistory", () => {
  // ── Carga inicial ──────────────────────────────────────
  it("muestra estado de carga mientras se cargan los logs", () => {
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise(() => {}) as never
    );

    render(<ActionHistory ownerId="owner-1" />);

    expect(screen.getByText(/Cargando\.\.\./i)).toBeTruthy();
    expect(screen.getByText(/Historial de Acciones/i)).toBeTruthy();
  });

  it("carga y muestra logs del owner", async () => {
    const logs = [
      makeLog({ id: "log-1", action: "PLAN_CHANGED" }),
      makeLog({ id: "log-2", action: "OWNER_CREATED", details: null }),
    ];
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk(logs) as never);

    render(<ActionHistory ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("Cambio de Plan")).toBeTruthy();
    });
    expect(screen.getByText("Propietario Creado")).toBeTruthy();

    expect(fetchSpy).toHaveBeenCalledWith("/api/admin/action-logs?targetId=owner-1");
  });

  it("muestra estado vacío si no hay logs", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([]) as never);

    render(<ActionHistory ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText(/No hay acciones registradas/i)).toBeTruthy();
    });
  });

  it("muestra error si falla la carga", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error()),
      } as Response) as never
    );

    render(<ActionHistory ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Error al cargar historial/i)).toBeTruthy();
    });
  });

  // ── Tipos de acción ──────────────────────────────────────
  it("renderiza etiqueta de acción con actionLabels (PLAN_CHANGED)", async () => {
    const log = makeLog({ action: "PLAN_CHANGED" });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([log]) as never);

    render(<ActionHistory ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("Cambio de Plan")).toBeTruthy();
    });
  });

  it("renderiza OWNER_DELETED con etiqueta localizada", async () => {
    const log = makeLog({ action: "OWNER_DELETED" });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([log]) as never);

    render(<ActionHistory ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("Propietario Eliminado")).toBeTruthy();
    });
  });

  it("usa el action string como fallback si no hay etiqueta localizada", async () => {
    const log = makeLog({ action: "CUSTOM_ACTION" });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([log]) as never);

    render(<ActionHistory ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("CUSTOM_ACTION")).toBeTruthy();
    });
  });

  // ── Detalles según action type ──────────────────────────────────────
  it("renderiza diff de plan para PLAN_CHANGED con before y after", async () => {
    const log = makeLog({
      action: "PLAN_CHANGED",
      details: JSON.stringify({ before: "FREE", after: "PRO" }),
    });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([log]) as never);

    render(<ActionHistory ownerId="owner-1" />);

    await waitFor(() => {
      // "FREE" tachado + "→" + "PRO"
      expect(screen.getByText("FREE")).toBeTruthy();
      expect(screen.getByText("PRO")).toBeTruthy();
      expect(screen.getByText(/Plan:/)).toBeTruthy();
    });
  });

  it("renderiza plan inicial para OWNER_CREATED", async () => {
    const log = makeLog({
      action: "OWNER_CREATED",
      details: JSON.stringify({ plan: "PRO", email: "x@test.com", name: "Test" }),
    });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([log]) as never);

    render(<ActionHistory ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Plan inicial:/)).toBeTruthy();
      expect(screen.getByText("PRO")).toBeTruthy();
    });
  });

  it("ignora details inválido (JSON malformado) sin crashear", async () => {
    const log = makeLog({ details: "not valid json" });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([log]) as never);

    render(<ActionHistory ownerId="owner-1" />);

    // No debe crashear; debe renderizar el log sin details
    await waitFor(() => {
      expect(screen.getByText("Cambio de Plan")).toBeTruthy();
    });
  });

  // ── Admin info ──────────────────────────────────────
  it("muestra nombre del admin si está disponible", async () => {
    const log = makeLog({ admin: { id: "admin-1", name: "María López", email: "maria@test.com" } });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([log]) as never);

    render(<ActionHistory ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("María López")).toBeTruthy();
    });
  });

  it("usa email como fallback si no hay nombre del admin", async () => {
    const log = makeLog({ admin: { id: "admin-1", name: null, email: "anon@test.com" } });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockFetchOk([log]) as never);

    render(<ActionHistory ownerId="owner-1" />);

    await waitFor(() => {
      expect(screen.getByText("anon@test.com")).toBeTruthy();
    });
  });
});
