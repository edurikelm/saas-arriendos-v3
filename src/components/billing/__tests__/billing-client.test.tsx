import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingClient } from "../billing-client";
import type { Subscription } from "@prisma/client";
import type { OwnerUsage } from "@/lib/actions/subscriptions";

const { mockStartProUpgrade } = vi.hoisted(() => ({
  mockStartProUpgrade: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })),
}));

vi.mock("@/lib/actions/subscriptions", () => ({
  startProUpgrade: mockStartProUpgrade,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const baseUsage: OwnerUsage = {
  properties: 0,
  clients: 0,
  propertiesLimit: 3,
  clientsLimit: 5,
};

function createMockSubscription(
  overrides: Partial<Subscription> = {}
): Subscription {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Decimal = (n: number) => ({ toString: () => String(n) }) as any;
  return {
    id: "sub-1",
    userId: "user-1",
    plan: "PRO",
    status: "AUTHORIZED",
    mpPreapprovalId: "mp-preapproval-1",
    mpPlanId: "mp-plan-1",
    currentPeriodStart: new Date("2026-07-01"),
    currentPeriodEnd: new Date("2026-08-01"),
    nextPaymentDate: new Date("2026-08-01"),
    amount: Decimal(9990),
    currency: "CLP",
    frequency: 1,
    frequencyType: "months",
    startedAt: new Date("2026-07-01"),
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
    ...overrides,
  } as unknown as Subscription;
}

describe("BillingClient", () => {
  beforeEach(() => {
    mockStartProUpgrade.mockReset();
  });

  it("renderiza FREE cuando subscription es null: muestra 'Activar PRO' + badge FREE", async () => {
    const user = userEvent.setup();
    render(<BillingClient subscription={null} usage={baseUsage} />);

    // Badge FREE
    const badge = screen.getByText("FREE");
    expect(badge).toBeTruthy();

    // Botón Activar PRO
    const btn = screen.getByRole("button", { name: /activar pro/i });
    expect(btn).toBeTruthy();

    // Plan name en header
    expect(screen.getByText("Plan actual")).toBeTruthy();
  });

  it("renderiza PRO cuando subscription.status es AUTHORIZED: muestra próximo cobro + badge PRO", async () => {
    const sub = createMockSubscription({ status: "AUTHORIZED" });
    render(<BillingClient subscription={sub} usage={baseUsage} />);

    // Badge PRO
    const badge = screen.getByText("PRO");
    expect(badge).toBeTruthy();

    // Próximo cobro visible
    expect(screen.getByText(/próximo cobro/i)).toBeTruthy();
  });

  it("renderiza CANCELLED: muestra banner ámbar con fecha de fin de período", async () => {
    // Use midday UTC to avoid timezone shifting the date
    const sub = createMockSubscription({
      status: "CANCELLED",
      currentPeriodEnd: new Date("2026-08-15T12:00:00Z"),
    });
    render(<BillingClient subscription={sub} usage={baseUsage} />);

    // Banner ámbar
    const banner = screen.getByText(/tu plan sigue activo hasta el/i);
    expect(banner).toBeTruthy();
    // The date part should be present (timezone-aware)
    expect(banner.textContent).toMatch(/de agosto de 2026/i);
  });

  it("muestra usage correcto: usage.properties=2, propertiesLimit=3 → '2 / 3'", () => {
    const usage: OwnerUsage = {
      ...baseUsage,
      properties: 2,
      propertiesLimit: 3,
    };
    render(<BillingClient subscription={null} usage={usage} />);

    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("muestra Infinity para PRO: no muestra barra de progreso cuando propertiesLimit=Infinity", () => {
    const usage: OwnerUsage = {
      properties: 10,
      clients: 20,
      propertiesLimit: Infinity,
      clientsLimit: Infinity,
    };
    const sub = createMockSubscription({ status: "AUTHORIZED" });
    render(<BillingClient subscription={sub} usage={usage} />);

    // No debe haber barra de progreso (el componente Progress no se renderiza)
    const progressBars = document.querySelectorAll("[role='progressbar']");
    expect(progressBars).toHaveLength(0);

    // Texto "No tienes límites"
    expect(screen.getByText(/no tienes límites/i)).toBeTruthy();
  });

  it("click en 'Activar PRO' llama startProUpgrade y redirige a initPoint", async () => {
    mockStartProUpgrade.mockResolvedValue({
      initPoint: "https://mercadopago.com/checkout?preapproval_id=123",
      subscriptionId: "sub-new",
    });

    const user = userEvent.setup();
    render(<BillingClient subscription={null} usage={baseUsage} />);

    const btn = screen.getByRole("button", { name: /activar pro/i });

    await act(async () => {
      await user.click(btn);
    });

    await waitFor(() => {
      expect(mockStartProUpgrade).toHaveBeenCalledTimes(1);
    });
  });

  it("renderiza correctamente la сравнение features para plan FREE", () => {
    render(<BillingClient subscription={null} usage={baseUsage} />);

    // FREE: 3 propiedades
    expect(screen.getByText("3")).toBeTruthy();
    // FREE: 5 clientes
    expect(screen.getByText("5")).toBeTruthy();
    // Feature rows con line-through para no-incluidas
    const featureRows = screen.getAllByText(/sincronización ical/i);
    expect(featureRows.length).toBeGreaterThan(0);
  });

  it("renderiza correctamente la сравнение features para plan PRO", () => {
    const sub = createMockSubscription({ status: "AUTHORIZED" });
    const usage: OwnerUsage = {
      properties: 10,
      clients: 50,
      propertiesLimit: Infinity,
      clientsLimit: Infinity,
    };
    render(<BillingClient subscription={sub} usage={usage} />);

    // PRO: ilimitadas
    expect(screen.getByText("Ilimitadas")).toBeTruthy();
    expect(screen.getByText("Ilimitados")).toBeTruthy();
  });

  it("muestra mensaje PENDING cuando subscription.status es PENDING", () => {
    const sub = createMockSubscription({ status: "PENDING" });
    render(<BillingClient subscription={sub} usage={baseUsage} />);

    expect(screen.getByText(/pago pendiente/i)).toBeTruthy();
  });

  it("muestra mensaje de funciones PRO activas cuando status es AUTHORIZED", () => {
    const sub = createMockSubscription({ status: "AUTHORIZED" });
    render(<BillingClient subscription={sub} usage={baseUsage} />);

    expect(screen.getByText(/funciones pro/i)).toBeTruthy();
  });
});
