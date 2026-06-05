import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    Download: vi.fn(() => "Download"),
    Shield: vi.fn(() => "Shield"),
    Users: vi.fn(() => "Users"),
    Trash2: vi.fn(() => "Trash2"),
    Search: vi.fn(() => "Search"),
    Plus: vi.fn(() => "Plus"),
    ChevronDown: vi.fn(() => "ChevronDown"),
    ChevronUp: vi.fn(() => "ChevronUp"),
    X: vi.fn(() => "X"),
  };
});

vi.mock("@/lib/actions/super-admin", () => ({
  updateUserPlan: vi.fn(),
  deleteUser: vi.fn(),
  createOwner: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

import { AdminUsersClient } from "../admin-users-client";

const mockUser = {
  id: "1",
  email: "admin@test.com",
  name: "Admin User",
  plan: "FREE",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  createdAt: "2025-01-01T00:00:00.000Z",
  _count: { properties: 0, clients: 0, reservations: 0 },
};

const healthyUser = {
  ...mockUser,
  id: "2",
  email: "healthy@test.com",
  name: "Healthy User",
  plan: "PRO",
  _count: { properties: 1, clients: 2, reservations: 3 },
  isMpConnected: true,
  hasOverduePayments: false,
};

const unhealthyUser = {
  ...mockUser,
  id: "3",
  email: "risk@test.com",
  name: "Risk User",
  plan: "FREE",
  _count: { properties: 0, clients: 0, reservations: 0 },
  isMpConnected: false,
  hasOverduePayments: true,
};

function createFetchMock() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ users: [mockUser], total: 1 }),
  });
}

describe("AdminUsersClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", createFetchMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Export CSV", () => {
    it("shows Exportar CSV button in the UI", async () => {
      render(<AdminUsersClient initialUsers={[mockUser]} initialTotal={1} />);

      await waitFor(() => {
        const exportButton = screen.getByRole("button", { name: /exportar csv/i });
        expect(exportButton).toBeDefined();
      });
    });

    it("clicking Exportar CSV sets window.location to export endpoint", async () => {
      const user = userEvent.setup();
      render(<AdminUsersClient initialUsers={[mockUser]} initialTotal={1} />);

      let locationHref = "";
      Object.defineProperty(window, "location", {
        value: {
          get href() { return locationHref; },
          set href(val) { locationHref = val; },
        },
        writable: true,
      });

      await waitFor(() => {
        const exportButton = screen.getByRole("button", { name: /exportar csv/i });
        expect(exportButton).toBeDefined();
      });

      const exportButton = screen.getByRole("button", { name: /exportar csv/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(locationHref).toContain("/api/admin/users/export");
      });
    });
  });

  describe("Health indicators", () => {
    it("shows health badges for a risky owner", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [unhealthyUser], total: 1 }),
      }));

      render(<AdminUsersClient initialUsers={[unhealthyUser]} initialTotal={1} />);

      expect(await screen.findByText("Sin propiedades")).toBeDefined();
      expect(screen.getByText("Sin reservas")).toBeDefined();
      expect(screen.getByText("MP desconectado")).toBeDefined();
      expect(screen.getByText("Pagos vencidos")).toBeDefined();
      expect(screen.queryByText("Al límite FREE")).toBeNull();
    });

    it("shows Activo for a healthy owner", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ users: [healthyUser], total: 1 }),
      }));

      render(<AdminUsersClient initialUsers={[healthyUser]} initialTotal={1} />);

      expect(await screen.findByText("Activo")).toBeDefined();
      expect(screen.queryByText("MP desconectado")).toBeNull();
    });
  });
});
