import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "../notification-bell";

const { mockMarkAll } = vi.hoisted(() => ({
  mockMarkAll: vi.fn().mockResolvedValue({ success: true, count: 5 }),
}));

vi.mock("@/lib/actions/notifications", () => ({
  markAllNotificationsAsRead: mockMarkAll,
  getRecentNotifications: vi.fn().mockResolvedValue([]),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

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

describe("NotificationBell", () => {
  beforeEach(() => {
    mockMarkAll.mockClear().mockResolvedValue({ success: true, count: 5 });
  });

  it("renders the Bell button with rounded-lg and correct aria-label", () => {
    render(<NotificationBell unreadCount={0} />);
    const bell = screen.getByLabelText("Notificaciones");
    expect(bell.className).toMatch(/\brounded-lg\b/);
  });

  it("does not render badge when unreadCount is 0", () => {
    const { container } = render(<NotificationBell unreadCount={0} />);
    const badges = container.querySelectorAll("span.bg-destructive");
    expect(badges).toHaveLength(0);
  });

  it("renders badge with count when unreadCount is greater than 0", () => {
    const { container } = render(<NotificationBell unreadCount={5} />);
    const badges = container.querySelectorAll("span.bg-destructive");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("5");
  });

  it("renders badge with '99+' when unreadCount exceeds 99", () => {
    const { container } = render(<NotificationBell unreadCount={150} />);
    const badges = container.querySelectorAll("span.bg-destructive");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("99+");
  });

  it("renders badge with exact count when count is between 1 and 99", () => {
    const { container } = render(<NotificationBell unreadCount={42} />);
    const badges = container.querySelectorAll("span.bg-destructive");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("42");
  });

  it("Bell button is still accessible when count is 0", () => {
    render(<NotificationBell unreadCount={0} />);
    const bell = screen.getByLabelText("Notificaciones");
    expect(bell).toBeTruthy();
  });

  it("Bell button is still accessible when count is greater than 0", () => {
    render(<NotificationBell unreadCount={10} />);
    const bell = screen.getByLabelText("Notificaciones");
    expect(bell).toBeTruthy();
  });

  it("calls markAllNotificationsAsRead when popover opens", async () => {
    const user = userEvent.setup();

    render(<NotificationBell unreadCount={5} />);
    const bell = screen.getByLabelText("Notificaciones");

    await act(async () => {
      await user.click(bell);
    });

    // markAllNotificationsAsRead is called when popover opens
    expect(mockMarkAll).toHaveBeenCalled();
  });
});
