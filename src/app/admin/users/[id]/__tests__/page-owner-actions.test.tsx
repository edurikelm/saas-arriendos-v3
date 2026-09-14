/**
 * Cableado de la página de detalle con las acciones de plan y eliminación.
 * Los componentes se prueban aparte; acá importa qué datos les llegan.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  planControl: vi.fn((_props: Record<string, unknown>) => null),
  deleteButton: vi.fn((_props: Record<string, unknown>) => null),
}));

vi.mock("@/lib/actions/admin-users", () => ({ getOwnerDetail: vi.fn() }));
vi.mock("@/lib/actions/super-admin", () => ({ updateUserStatus: vi.fn() }));
vi.mock("@/components/admin/admin-owner-notes", () => ({ AdminOwnerNotes: () => null }));
vi.mock("@/components/admin/action-history", () => ({ ActionHistory: () => null }));
vi.mock("@/lib/subscriptions/queries", () => ({ getActiveSubscription: vi.fn().mockResolvedValue(null) }));
vi.mock("@/components/admin/admin-cancel-subscription-button", () => ({
  AdminCancelSubscriptionButton: () => null,
}));
vi.mock("@/components/admin/admin-owner-plan-control", () => ({
  AdminOwnerPlanControl: mocks.planControl,
}));
vi.mock("@/components/admin/admin-delete-owner-button", () => ({
  AdminDeleteOwnerButton: mocks.deleteButton,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import { getOwnerDetail, type OwnerDetailResult } from "@/lib/actions/admin-users";

function detail(owner: Partial<OwnerDetailResult["owner"]>): OwnerDetailResult {
  return {
    owner: {
      id: "owner-1",
      name: "Owner",
      email: "owner@test.com",
      plan: "FREE",
      planOverride: null,
      subscription: null,
      status: "ACTIVE",
      role: "OWNER",
      createdAt: new Date("2026-01-01T12:00:00Z"),
      _count: { properties: 0, clients: 0, reservations: 0 },
      ...owner,
    },
    stats: {
      properties: 0,
      clients: 0,
      reservations: 0,
      totalRevenue: 0,
      paidAmount: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      propertiesLimit: 3,
      hasMpIntegration: false,
      isMpConnected: false,
    },
    properties: [],
    reservations: [],
    payments: [],
  };
}

async function renderPage() {
  const Page = (await import("@/app/admin/users/[id]/page")).default;
  render(await Page({ params: Promise.resolve({ id: "owner-1" }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminUserDetailPage: plan y eliminación", () => {
  it("un owner sin suscripción se puede eliminar y el plan de su suscripción es FREE", async () => {
    vi.mocked(getOwnerDetail).mockResolvedValue(detail({}));

    await renderPage();

    expect(mocks.deleteButton.mock.calls[0][0]).toEqual({
      ownerId: "owner-1",
      email: "owner@test.com",
      hasSubscriptionHistory: false,
    });
    expect(mocks.planControl.mock.calls[0][0]).toEqual({
      userId: "owner-1",
      planOverride: null,
      subscriptionPlan: "FREE",
    });
  });

  it("una suscripción que ya no da PRO igual bloquea la eliminación", async () => {
    // Caso real de producción: fila PENDING, nunca autorizada.
    vi.mocked(getOwnerDetail).mockResolvedValue(
      detail({
        plan: "PRO",
        subscription: { status: "PENDING", currentPeriodEnd: null, mpPreapprovalId: null },
      }),
    );

    await renderPage();

    expect(mocks.deleteButton.mock.calls[0][0]).toMatchObject({ hasSubscriptionHistory: true });
    // La columna dice PRO; el control recibe lo que da la suscripción.
    expect(mocks.planControl.mock.calls[0][0]).toMatchObject({ subscriptionPlan: "FREE" });
  });

  it("pasa la concesión manual y el plan de una suscripción vigente", async () => {
    vi.mocked(getOwnerDetail).mockResolvedValue(
      detail({
        planOverride: "PRO",
        subscription: {
          status: "AUTHORIZED",
          currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          mpPreapprovalId: "pre-1",
        },
      }),
    );

    await renderPage();

    expect(mocks.planControl.mock.calls[0][0]).toMatchObject({
      planOverride: "PRO",
      subscriptionPlan: "PRO",
    });
  });
});
