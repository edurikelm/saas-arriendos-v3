import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/admin-users", () => ({
  getOwnerDetail: vi.fn(),
}));

vi.mock("@/lib/actions/super-admin", () => ({
  updateUserStatus: vi.fn(),
}));

vi.mock("@/lib/actions/audit", () => ({
  recordAdminAction: vi.fn(),
}));

vi.mock("@/components/admin/admin-owner-notes", () => ({
  AdminOwnerNotes: () => null,
}));

vi.mock("@/components/admin/action-history", () => ({
  ActionHistory: () => null,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

import { getOwnerDetail } from "@/lib/actions/admin-users";

const mockData = {
  owner: {
    id: "user-123",
    name: "Test Owner",
    email: "test@example.com",
    plan: "PRO" as const,
    role: "OWNER",
    status: "ACTIVE" as const,
    createdAt: new Date(),
    _count: { properties: 1, clients: 2, reservations: 3 },
  },
  stats: {
    properties: 1,
    clients: 2,
    reservations: 3,
    totalRevenue: 1500000,
    paidAmount: 1000000,
    pendingAmount: 300000,
    overdueAmount: 200000,
    propertiesLimit: 3,
    hasMpIntegration: true,
    isMpConnected: true,
  },
  properties: [],
  reservations: [],
  payments: [],
};

describe("AdminUserDetailPage - radius system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOwnerDetail).mockResolvedValue(mockData);
  });

  it("status badge uses rectangular radius (rounded-md), not pill radius", async () => {
    const Page = (await import("@/app/admin/users/[id]/page")).default;
    const element = await Page({ params: Promise.resolve({ id: "user-123" }) });
    const { container } = render(element);

    await waitFor(() => {
      expect(container.textContent).toContain("ACTIVE");
    });

    const statusBadge = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent?.trim() === "ACTIVE"
    );
    expect(statusBadge).toBeTruthy();
    expect(statusBadge!.className).not.toMatch(/\brounded-full\b/);
    expect(statusBadge!.className).toMatch(/\brounded-md\b/);
  });

  it("plan badge uses rectangular radius (rounded-md), not pill radius", async () => {
    const Page = (await import("@/app/admin/users/[id]/page")).default;
    const element = await Page({ params: Promise.resolve({ id: "user-123" }) });
    const { container } = render(element);

    await waitFor(() => {
      expect(container.textContent).toContain("PRO");
    });

    const planBadges = Array.from(container.querySelectorAll("span, div")).filter(
      (el) => el.textContent?.trim() === "PRO"
    );
    expect(planBadges.length).toBeGreaterThan(0);
    planBadges.forEach((badge) => {
      expect(badge.className).not.toMatch(/\brounded-full\b/);
    });
  });

  it("MP integration icon container (connected) uses rectangular radius (rounded-lg), not pill radius", async () => {
    vi.mocked(getOwnerDetail).mockResolvedValueOnce({
      ...mockData,
      stats: { ...mockData.stats, hasMpIntegration: true, isMpConnected: true },
    });
    const Page = (await import("@/app/admin/users/[id]/page")).default;
    const element = await Page({ params: Promise.resolve({ id: "user-123" }) });
    const { container } = render(element);

    await waitFor(() => {
      expect(container.textContent).toContain("Conectado y activo");
    });

    const connectedContainers = Array.from(container.querySelectorAll("div")).filter(
      (el) =>
        el.classList.contains("size-9") &&
        el.classList.contains("rounded-lg") &&
        el.classList.contains("bg-emerald-500/10")
    );
    expect(connectedContainers.length).toBeGreaterThan(0);
    connectedContainers.forEach((node) => {
      expect(node.className).not.toMatch(/\brounded-full\b/);
    });
  });

  it("MP integration icon container (inactive) uses rectangular radius (rounded-lg), not pill radius", async () => {
    vi.mocked(getOwnerDetail).mockResolvedValueOnce({
      ...mockData,
      stats: { ...mockData.stats, hasMpIntegration: true, isMpConnected: false },
    });
    const Page = (await import("@/app/admin/users/[id]/page")).default;
    const element = await Page({ params: Promise.resolve({ id: "user-123" }) });
    const { container } = render(element);

    await waitFor(() => {
      expect(container.textContent).toContain("Cuenta conectada pero inactiva");
    });

    const inactiveContainers = Array.from(container.querySelectorAll("div")).filter(
      (el) =>
        el.classList.contains("size-9") &&
        el.classList.contains("rounded-lg") &&
        el.classList.contains("bg-amber-500/10")
    );
    expect(inactiveContainers.length).toBeGreaterThan(0);
    inactiveContainers.forEach((node) => {
      expect(node.className).not.toMatch(/\brounded-full\b/);
    });
  });

  it("MP integration icon container (not configured) uses rectangular radius (rounded-lg), not pill radius", async () => {
    vi.mocked(getOwnerDetail).mockResolvedValueOnce({
      ...mockData,
      stats: { ...mockData.stats, hasMpIntegration: false, isMpConnected: false },
    });
    const Page = (await import("@/app/admin/users/[id]/page")).default;
    const element = await Page({ params: Promise.resolve({ id: "user-123" }) });
    const { container } = render(element);

    await waitFor(() => {
      expect(container.textContent).toContain("No configurado");
    });

    const notConfiguredContainers = Array.from(container.querySelectorAll("div")).filter(
      (el) =>
        el.classList.contains("size-9") &&
        el.classList.contains("rounded-lg") &&
        el.classList.contains("bg-red-500/10")
    );
    expect(notConfiguredContainers.length).toBeGreaterThan(0);
    notConfiguredContainers.forEach((node) => {
      expect(node.className).not.toMatch(/\brounded-full\b/);
    });
  });
});
