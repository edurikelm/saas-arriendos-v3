import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardNavbar } from "../dashboard-navbar";
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

function renderNavbar(props: {
  userName?: string | null;
  userRole?: string;
  userPlan?: string | null;
} = {}) {
  return render(
    <ThemeProvider>
      <DashboardNavbar {...props} />
    </ThemeProvider>
  );
}

function findDateChipContainer(container: HTMLElement) {
  const label = container.querySelector(
    'header span.capitalize'
  ) as HTMLElement | null;
  if (!label) return null;
  return label.parentElement as HTMLElement | null;
}

describe("DashboardNavbar radius system (issue #150)", () => {
  it("renders the date chip with rounded-lg and not rounded-full", async () => {
    const { container } = renderNavbar({
      userName: "Carlos",
      userRole: "USER",
      userPlan: "PRO",
    });
    await screen.findByLabelText("Cambiar tema");
    const dateChip = findDateChipContainer(container);
    expect(dateChip).not.toBeNull();
    expect(dateChip!.className).toMatch(/\brounded-lg\b/);
    expect(dateChip!.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the segmented control bar wrapper with rounded-lg and not rounded-full", async () => {
    const { container } = renderNavbar({
      userName: "Carlos",
      userRole: "USER",
      userPlan: "PRO",
    });
    const themeTrigger = await screen.findByLabelText("Cambiar tema");
    const wrapper = themeTrigger.parentElement as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toMatch(/\brounded-lg\b/);
    expect(wrapper!.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the theme toggle trigger with rounded-lg and not rounded-full", async () => {
    renderNavbar({
      userName: "Carlos",
      userRole: "USER",
      userPlan: "PRO",
    });
    const themeTrigger = await screen.findByLabelText("Cambiar tema");
    expect(themeTrigger.className).toMatch(/\brounded-lg\b/);
    expect(themeTrigger.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the notifications trigger with rounded-lg and not rounded-full", async () => {
    renderNavbar({
      userName: "Carlos",
      userRole: "USER",
      userPlan: "PRO",
    });
    const bell = await screen.findByLabelText("Notificaciones");
    expect(bell.className).toMatch(/\brounded-lg\b/);
    expect(bell.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the user menu trigger with rounded-lg and not rounded-full", async () => {
    renderNavbar({
      userName: "Carlos",
      userRole: "USER",
      userPlan: "PRO",
    });
    const userMenu = await screen.findByLabelText("Menú de usuario");
    expect(userMenu.className).toMatch(/\brounded-lg\b/);
    expect(userMenu.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the PRO plan badge with rounded-md and not rounded-full", async () => {
    renderNavbar({
      userName: "Carlos",
      userRole: "USER",
      userPlan: "PRO",
    });
    const badge = await screen.findByText("PRO");
    expect(badge.className).toMatch(/\brounded-md\b/);
    expect(badge.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the ADMIN plan badge with rounded-md and not rounded-full", async () => {
    renderNavbar({
      userName: "Carla",
      userRole: "SUPER_ADMIN",
      userPlan: "PRO",
    });
    const badge = await screen.findByText("ADMIN");
    expect(badge.className).toMatch(/\brounded-md\b/);
    expect(badge.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the Super Admin chip with rounded-md and not rounded-full", async () => {
    renderNavbar({
      userName: "Carla",
      userRole: "SUPER_ADMIN",
      userPlan: "PRO",
    });
    const chip = await screen.findByText("Super Admin");
    const chipContainer = chip.parentElement as HTMLElement | null;
    expect(chipContainer).not.toBeNull();
    expect(chipContainer!.className).toMatch(/\brounded-md\b/);
    expect(chipContainer!.className).not.toMatch(/\brounded-full\b/);
  });

  it("renders the user initials avatar with rounded-full (regression)", async () => {
    const { container } = renderNavbar({
      userName: "Carlos",
      userRole: "USER",
      userPlan: "PRO",
    });
    await screen.findByLabelText("Cambiar tema");
    const avatar = container.querySelector(
      'header span.size-7.bg-foreground'
    ) as HTMLElement | null;
    expect(avatar).not.toBeNull();
    expect(avatar!.className).toMatch(/\brounded-full\b/);
  });
});
