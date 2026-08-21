import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Subscription } from "@prisma/client";

import { PlanOverviewCard } from "../plan-overview-card";
import type { OwnerUsage } from "@/lib/actions/subscriptions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const baseUsage: OwnerUsage = {
  properties: 1,
  clients: 2,
  propertiesLimit: 3,
  clientsLimit: 5,
};

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

describe("<PlanOverviewCard />", () => {
  it("muestra badge FREE y CTA 'Pasar a PRO' cuando no hay subscription", () => {
    render(
      <PlanOverviewCard subscription={null} usage={baseUsage} />,
    );
    expect(screen.getByText("FREE")).toBeTruthy();
    expect(screen.getByText(/Plan gratuito/)).toBeTruthy();
    const cta = screen.getByRole("link", { name: /Pasar a PRO/i });
    expect(cta.getAttribute("href")).toBe("/settings/billing");
  });

  it("muestra badge PRO, precio y CTA 'Administrar plan' cuando AUTHORIZED", () => {
    render(
      <PlanOverviewCard subscription={makeSub()} usage={baseUsage} />,
    );
    expect(screen.getByText("PRO")).toBeTruthy();
    expect(screen.getByText(/\$9\.990 \/ mes/)).toBeTruthy();
    expect(screen.getByText(/Próximo cobro:/)).toBeTruthy();
    const cta = screen.getByRole("link", { name: /Administrar plan/i });
    expect(cta.getAttribute("href")).toBe("/settings/billing");
  });

  it("muestra alerta de cancelación y CTA 'Reactivar PRO' cuando CANCELLED con período vigente", () => {
    const sub = makeSub({
      status: "CANCELLED",
      cancelledAt: new Date(),
    });
    render(<PlanOverviewCard subscription={sub} usage={baseUsage} />);
    expect(screen.getByText(/sigue activo hasta el/)).toBeTruthy();
    const cta = screen.getByRole("link", { name: /Reactivar PRO/i });
    expect(cta.getAttribute("href")).toBe("/settings/billing");
  });

  it("muestra alerta de pago pendiente y CTA 'Revisar pago pendiente' cuando PENDING", () => {
    render(
      <PlanOverviewCard
        subscription={makeSub({ status: "PENDING" })}
        usage={baseUsage}
      />,
    );
    expect(
      screen.getByText(/pago de Mercado Pago pendiente/),
    ).toBeTruthy();
    const cta = screen.getByRole("link", {
      name: /Revisar pago pendiente/i,
    });
    expect(cta.getAttribute("href")).toBe("/settings/billing");
  });

  it("trata CANCELLED con período expirado como FREE (bajó automáticamente)", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sub = makeSub({
      status: "CANCELLED",
      cancelledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: past,
    });
    render(<PlanOverviewCard subscription={sub} usage={baseUsage} />);
    expect(screen.getByText("FREE")).toBeTruthy();
    const cta = screen.getByRole("link", { name: /Pasar a PRO/i });
    expect(cta.getAttribute("href")).toBe("/settings/billing");
  });
});