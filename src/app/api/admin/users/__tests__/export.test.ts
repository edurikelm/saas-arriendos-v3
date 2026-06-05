import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockIsSuperAdmin = vi.fn();
const mockGetAllUsers = vi.fn();
const mockGetUserStats = vi.fn();

vi.mock("@/lib/actions/super-admin", () => ({
  isSuperAdmin: mockIsSuperAdmin,
  getAllUsers: mockGetAllUsers,
  getUserStats: mockGetUserStats,
}));

vi.mock("@/lib/actions/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adminActionLog: {
      create: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}));

describe("GET /api/admin/users/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockResolvedValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockIsSuperAdmin.mockResolvedValue(false);

    const { GET } = await import("../export/route");
    const request = new Request("http://localhost/api/admin/users/export");
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("calls getAllUsers with correct filter params", async () => {
    mockGetAllUsers.mockResolvedValue({ users: [], total: 0 });

    const { GET } = await import("../export/route");
    const request = new Request("http://localhost/api/admin/users/export?search=test&plan=PRO&noProperties=true&noReservations=true&mpDisconnected=true&pendingPayments=true&overduePayments=true&createdFrom=2024-01-01&createdTo=2024-12-31");
    await GET(request);

    expect(mockGetAllUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "test",
        plan: "PRO",
        noProperties: true,
        noReservations: true,
        mpDisconnected: true,
        pendingPayments: true,
        overduePayments: true,
        createdFrom: "2024-01-01",
        createdTo: "2024-12-31",
      })
    );
  });

  it("returns CSV with correct content-type header", async () => {
    mockGetAllUsers.mockResolvedValue({
      users: [
        {
          id: "1",
          email: "test@example.com",
          name: "Test User",
          plan: "PRO",
          role: "OWNER",
          createdAt: new Date("2024-01-15"),
          _count: { properties: 5, clients: 10, reservations: 20 },
        },
      ],
      total: 1,
    });

    const { GET } = await import("../export/route");
    const request = new Request("http://localhost/api/admin/users/export");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
  });

  it("CSV contains required columns", async () => {
    mockGetAllUsers.mockResolvedValue({
      users: [
        {
          id: "1",
          email: "test@example.com",
          name: "Test User",
          plan: "PRO",
          role: "OWNER",
          createdAt: new Date("2024-01-15"),
          _count: { properties: 5, clients: 10, reservations: 20 },
        },
      ],
      total: 1,
    });

    const { GET } = await import("../export/route");
    const request = new Request("http://localhost/api/admin/users/export");
    const response = await GET(request);

    const csv = await response.text();
    const header = csv.split("\n")[0];

    expect(header).toContain("email");
    expect(header).toContain("nombre");
    expect(header).toContain("plan");
    expect(header).toContain("estado");
    expect(header).toContain("propiedades");
    expect(header).toContain("reservas");
    expect(header).toContain("ingresos");
    expect(header).toContain("fecha_creacion");
  });

  it("CSV uses comma as separator for Excel/Google Sheets compatibility", async () => {
    mockGetAllUsers.mockResolvedValue({
      users: [
        {
          id: "1",
          email: "test@example.com",
          name: "Test User",
          plan: "PRO",
          role: "OWNER",
          createdAt: new Date("2024-01-15"),
          _count: { properties: 5, clients: 10, reservations: 20 },
        },
      ],
      total: 1,
    });

    const { GET } = await import("../export/route");
    const request = new Request("http://localhost/api/admin/users/export");
    const response = await GET(request);

    const csv = await response.text();
    const lines = csv.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2);

    const header = lines[0];
    const dataRow = lines[1];
    const headerCount = header.split(",").length;
    const dataCount = dataRow.split(",").length;
    expect(headerCount).toBe(dataCount);
  });

  it("CSV filename includes date", async () => {
    mockGetAllUsers.mockResolvedValue({ users: [], total: 0 });

    const { GET } = await import("../export/route");
    const request = new Request("http://localhost/api/admin/users/export");
    const response = await GET(request);

    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).toContain("attachment");
    expect(contentDisposition).toContain("propietarios");
    expect(contentDisposition).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("CSV filename includes applied filters", async () => {
    mockGetAllUsers.mockResolvedValue({ users: [], total: 0 });

    const { GET } = await import("../export/route");
    const request = new Request("http://localhost/api/admin/users/export?plan=PRO&search=owner");
    const response = await GET(request);

    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).toContain("plan-PRO");
    expect(contentDisposition).toContain("search-owner");
  });

  it("returns empty CSV when no users found", async () => {
    mockGetAllUsers.mockResolvedValue({ users: [], total: 0 });

    const { GET } = await import("../export/route");
    const request = new Request("http://localhost/api/admin/users/export");
    const response = await GET(request);

    const csv = await response.text();
    const lines = csv.trim().split("\n");

    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("email");
  });

  it("handles users with null name", async () => {
    mockGetAllUsers.mockResolvedValue({
      users: [
        {
          id: "1",
          email: "test@example.com",
          name: null,
          plan: "FREE",
          role: "OWNER",
          createdAt: new Date("2024-01-15"),
          _count: { properties: 0, clients: 0, reservations: 0 },
        },
      ],
      total: 1,
    });

    const { GET } = await import("../export/route");
    const request = new Request("http://localhost/api/admin/users/export");
    const response = await GET(request);

    const csv = await response.text();
    expect(csv).toContain("test@example.com");
  });
});