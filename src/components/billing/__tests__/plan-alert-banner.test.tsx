import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Subscription } from "@prisma/client";

import { PlanAlertBanner } from "../plan-alert-banner";
import type { OwnerUsage } from "@/lib/actions/subscriptions";

// next/link no necesita router real — usa anchor simple en jsdom
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const baseUsage: OwnerUsage = {
  properties: 0,
  clients: 0,
  propertiesLimit: 3,
  clientsLimit: 5,
};

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
   
  return {
    id: "sub_1",
    userId: "user_1",
    status: "AUTHORIZED",
    mpPreapprovalId: "mp_1",
    mpPlanId: null,
    currentPeriodStart: now,
    currentPeriodEnd: future,
    nextPaymentDate: future,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Subscription;
}

describe("<PlanAlertBanner />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no renderiza nada en estado estable (FREE lejos del límite)", () => {
    const { container } = render(
      <PlanAlertBanner
        subscription={null}
        usage={{ ...baseUsage, properties: 0, clients: 0 }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("no renderiza cuando el owner es PRO activo", () => {
    const { container } = render(
      <PlanAlertBanner subscription={makeSub()} usage={baseUsage} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("muestra banner 'cerca del límite' cuando FREE con 2 propiedades", () => {
    render(
      <PlanAlertBanner
        subscription={null}
        usage={{ ...baseUsage, properties: 2, clients: 1 }}
      />,
    );
    expect(
      screen.getByText("Cerca del límite de tu plan FREE"),
    ).toBeTruthy();
    expect(screen.getByText(/2\/3 propiedades/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Pasar a PRO/i });
    expect(link.getAttribute("href")).toBe("/settings/billing");
  });

  it("muestra banner 'cerca del límite' cuando FREE con 4 clientes", () => {
    render(
      <PlanAlertBanner
        subscription={null}
        usage={{ ...baseUsage, properties: 1, clients: 4 }}
      />,
    );
    expect(
      screen.getByText("Cerca del límite de tu plan FREE"),
    ).toBeTruthy();
    expect(screen.getByText(/4\/5 clientes/)).toBeTruthy();
  });

  it("muestra banner 'cerca del límite' cuando FREE con 2 propiedades Y 4 clientes", () => {
    render(
      <PlanAlertBanner
        subscription={null}
        usage={{ ...baseUsage, properties: 2, clients: 4 }}
      />,
    );
    expect(
      screen.getByText(/2\/3 propiedades y 4\/5 clientes/),
    ).toBeTruthy();
  });

  it("muestra banner de cancelación cuando CANCELLED con período vigente", () => {
    const sub = makeSub({
      status: "CANCELLED",
      cancelledAt: new Date(),
    });
    render(<PlanAlertBanner subscription={sub} usage={baseUsage} />);
    expect(
      screen.getByText("Tu plan PRO está cancelándose"),
    ).toBeTruthy();
    expect(screen.getByText(/Sigue activo hasta el/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Reactivar PRO/i });
    expect(link.getAttribute("href")).toBe("/settings/billing");
  });

  it("no muestra banner cuando CANCELLED con período ya expirado (bajó a FREE)", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sub = makeSub({
      status: "CANCELLED",
      cancelledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: past,
    });
    const { container } = render(
      <PlanAlertBanner subscription={sub} usage={baseUsage} />,
    );
    expect(container.firstChild).toBeNull();
  });
});