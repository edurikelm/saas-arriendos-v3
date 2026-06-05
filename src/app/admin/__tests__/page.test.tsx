import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/super-admin", () => ({
  getDashboardStats: vi.fn(),
  getRecentOwners: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { getDashboardStats, getRecentOwners } from "@/lib/actions/super-admin";

const mockStats = {
  totalOwners: 10,
  totalProperties: 25,
  totalReservations: 80,
  totalRevenue: 1500000,
  growthPercentage: 15,
  ownersThisMonth: 3,
  ownersLastMonth: 2,
  conversionPercentage: 20,
};

const mockOwners = [
  {
    id: "user-1",
    email: "alice@example.com",
    plan: "PRO" as const,
    createdAt: new Date(),
    _count: { properties: 4, reservations: 12 },
  },
  {
    id: "user-2",
    email: "bob@example.com",
    plan: "FREE" as const,
    createdAt: new Date(),
    _count: { properties: 1, reservations: 2 },
  },
];

describe("AdminDashboardPage - radius system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDashboardStats).mockResolvedValue(mockStats);
    vi.mocked(getRecentOwners).mockResolvedValue(mockOwners);
  });

  it("'Panel de control' chip uses rectangular radius (rounded-md), not pill radius", async () => {
    const Page = (await import("@/app/admin/page")).default;
    const { container } = render(await Page());

    await waitFor(() => {
      expect(container.textContent).toContain("Panel de control");
    });

    const panelChip = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent?.trim() === "Panel de control"
    );
    expect(panelChip).toBeTruthy();
    expect(panelChip!.className).not.toMatch(/\brounded-full\b/);
    expect(panelChip!.className).toMatch(/\brounded-md\b/);
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
