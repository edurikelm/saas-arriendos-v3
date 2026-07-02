import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

import { DashboardLayoutClient } from "../dashboard-layout-client";
import { ThemeProvider } from "@/components/providers/theme-provider";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

afterAll(() => {
  Reflect.deleteProperty(window, "matchMedia");
});

function renderLayout(
  overrides: Partial<{
    userName: string | null;
    userRole: string | null;
    userPlan: string | null;
  }> = {}
) {
  return render(
    <ThemeProvider>
      <DashboardLayoutClient
        userName={overrides.userName ?? "Carlos"}
        userRole={overrides.userRole ?? "USER"}
        userPlan={overrides.userPlan ?? "PRO"}
      >
        <div>child</div>
      </DashboardLayoutClient>
    </ThemeProvider>
  );
}

function getMobileHeader(container: HTMLElement) {
  const header = container.querySelector(
    'div.sticky.top-0.lg\\:hidden'
  ) as HTMLElement | null;
  return header;
}

describe("DashboardLayoutClient mobile header radius system (issue #150)", () => {
  async function getMobileThemeTrigger(container: HTMLElement) {
    const mobileHeader = getMobileHeader(container);
    expect(mobileHeader).not.toBeNull();
    const themeTriggers = await screen.findAllByLabelText("Cambiar tema");
    const mobile = themeTriggers.find((el) => mobileHeader!.contains(el));
    expect(mobile).toBeDefined();
    return mobile as HTMLElement;
  }

  it("renders the mobile segmented control bar wrapper with rounded-lg and not rounded-full", async () => {
    const { container } = renderLayout();
    const themeTrigger = await getMobileThemeTrigger(container);
    const wrapper = themeTrigger.parentElement as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toMatch(/\brounded-lg\b/);
    expect(wrapper!.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the mobile theme toggle trigger with rounded-lg and not rounded-full", async () => {
    const { container } = renderLayout();
    const themeTrigger = await getMobileThemeTrigger(container);
    expect(themeTrigger.className).toMatch(/\brounded-lg\b/);
    expect(themeTrigger.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the mobile notifications trigger with rounded-lg and not rounded-full", async () => {
    const { container } = renderLayout();
    await getMobileThemeTrigger(container);
    const bells = screen.getAllByLabelText("Notificaciones");
    const mobile = bells.find((el) => getMobileHeader(container)!.contains(el));
    expect(mobile).toBeDefined();
    expect(mobile!.className).toMatch(/\brounded-lg\b/);
    expect(mobile!.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the mobile user menu trigger with rounded-lg and not rounded-full", async () => {
    const { container } = renderLayout();
    await getMobileThemeTrigger(container);
    const menus = screen.getAllByLabelText("Menú de usuario");
    const mobile = menus.find((el) => getMobileHeader(container)!.contains(el));
    expect(mobile).toBeDefined();
    expect(mobile!.className).toMatch(/\brounded-lg\b/);
    expect(mobile!.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the mobile user initials avatar with rounded-full (regression)", async () => {
    const { container } = renderLayout();
    await getMobileThemeTrigger(container);
    const mobileHeader = getMobileHeader(container);
    expect(mobileHeader).not.toBeNull();
    const avatar = mobileHeader!.querySelector(
      'span.size-7.bg-foreground'
    ) as HTMLElement | null;
    expect(avatar).not.toBeNull();
    expect(avatar!.className).toMatch(/\brounded-full\b/);
  });
});
