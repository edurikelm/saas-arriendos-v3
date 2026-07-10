import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/super-admin", () => ({
  getDashboardStats: vi.fn(),
  getRecentOwners: vi.fn(),
  getSystemActivity: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  getDashboardStats,
  getRecentOwners,
  getSystemActivity,
} from "@/lib/actions/super-admin";

const mockStats = {
  totalOwners: 10,
  totalProperties: 25,
  totalReservations: 80,
  totalRevenue: 1500000,
  growthPercentage: 15,
  ownersThisMonth: 3,
  ownersLastMonth: 2,
  conversionPercentage: 20,
  pendingSupportTickets: 5,
};

const mockOwners = [
  {
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    companyName: "Inmobiliaria Andes",
    plan: "PRO" as const,
    createdAt: new Date(),
    _count: { properties: 4, reservations: 12 },
  },
  {
    id: "user-2",
    name: "Bob",
    email: "bob@example.com",
    companyName: null,
    plan: "FREE" as const,
    createdAt: new Date(),
    _count: { properties: 1, reservations: 2 },
  },
];

const mockActivity = [
  {
    id: "owner-user-1",
    type: "OWNER_REGISTERED" as const,
    title: "Nuevo propietario",
    description: "Inmobiliaria Andes se unió al sistema.",
    createdAt: new Date().toISOString(),
  },
];

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDashboardStats).mockResolvedValue(mockStats);
    vi.mocked(getRecentOwners).mockResolvedValue(mockOwners);
    vi.mocked(getSystemActivity).mockResolvedValue(mockActivity);
  });

  it("renders the global control panel header", async () => {
    const Page = (await import("@/app/admin/page")).default;
    const { container } = render(await Page());

    await waitFor(() => {
      expect(container.textContent).toContain("Panel de Control Global");
    });
  });

  it("renders the support tickets KPI and system activity feed", async () => {
    const Page = (await import("@/app/admin/page")).default;
    const { container } = render(await Page());

    await waitFor(() => {
      expect(container.textContent).toContain("Tickets de Soporte");
      expect(container.textContent).toContain("Actividad Reciente del Sistema");
    });
  });

  it("plan badges use rectangular radius (rounded-md) via Badge override", async () => {
    const Page = (await import("@/app/admin/page")).default;
    const { container } = render(await Page());

    await waitFor(() => {
      expect(container.textContent).toContain("PRO");
    });

    const proBadge = Array.from(container.querySelectorAll("span, div")).find(
      (el) => el.textContent?.trim() === "PRO"
    );
    expect(proBadge).toBeTruthy();
    expect(proBadge!.className).not.toMatch(/\brounded-full\b/);
    expect(proBadge!.className).toMatch(/\brounded-md\b/);
  });
});
