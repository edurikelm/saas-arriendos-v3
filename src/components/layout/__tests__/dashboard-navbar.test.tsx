import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardNavbar } from "../dashboard-navbar";

const { mockMarkAll, mockGetRecent, mockNotificationBell } = vi.hoisted(() => ({
  mockMarkAll: vi.fn().mockResolvedValue({ success: true, count: 5 }),
  mockGetRecent: vi.fn().mockResolvedValue([]),
  mockNotificationBell: vi.fn(({ unreadCount, children }: any) => (
    <button aria-label="Notificaciones" data-unread-count={unreadCount}>
      {unreadCount != null && unreadCount > 0 && (
        <span className="bg-destructive">{unreadCount}</span>
      )}
      {children}
    </button>
  )),
}));

vi.mock("@/lib/actions/notifications", () => ({
  markAllNotificationsAsRead: mockMarkAll,
  getRecentNotifications: mockGetRecent,
}));

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: mockNotificationBell,
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

describe("DashboardNavbar", () => {
  beforeEach(() => {
    mockMarkAll.mockClear().mockResolvedValue({ success: true, count: 5 });
    mockGetRecent.mockClear().mockResolvedValue([]);
    mockNotificationBell.mockClear();
  });

  it("renders the eyebrow text", () => {
    render(<DashboardNavbar />);
    const eyebrow = screen.getByText("Panel de Administración");
    expect(eyebrow).not.toBeNull();
  });

  it("renders the search input", () => {
    render(<DashboardNavbar />);
    const searchInput = screen.getByPlaceholderText("Buscar...");
    expect(searchInput).not.toBeNull();
  });

  it("renders NotificationBell accessible control with badge when unreadCount > 0", () => {
    render(<DashboardNavbar notificationUnreadCount={5} />);
    const bell = screen.getByLabelText("Notificaciones");
    expect(bell).not.toBeNull();
    // Badge shows count
    const badge = document.querySelector("span.bg-destructive");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("5");
  });

  it("renders NotificationBell accessible control with no badge when unreadCount is 0", () => {
    render(<DashboardNavbar notificationUnreadCount={0} />);
    const bell = screen.getByLabelText("Notificaciones");
    expect(bell).not.toBeNull();
    const badge = document.querySelector("span.bg-destructive");
    expect(badge).toBeNull();
  });

  it("renders HelpCircle button", () => {
    render(<DashboardNavbar />);
    const helpButtons = screen.getAllByRole("button");
    const helpButton = helpButtons.find((btn) =>
      btn.querySelector('svg[class*="lucide-help-circle"]')
    );
    expect(helpButton).not.toBeNull();
  });

  it("does NOT render a raw Bell button (regression for notification popover bug)", () => {
    // The bug was: a raw <button><Bell /></button> that doesn't open the popover.
    // After the fix, only the NotificationBell component should be present.
    const { container } = render(<DashboardNavbar notificationUnreadCount={0} />);
    // If there were a raw Bell button, screen.getByLabelText would find it (aria-label="Notificaciones").
    // But we assert the correct NotificationBell is used with the accessible control.
    // To detect a raw Bell (no accessible label), we check there's exactly ONE button with a Bell icon,
    // and it is the NotificationBell's popover trigger (found via aria-label).
    const bellButtons = container.querySelectorAll("button");
    // Should have exactly 2 buttons: NotificationBell trigger + HelpCircle
    expect(bellButtons.length).toBe(2);
  });

  it("header is desktop-only: has hidden and lg:flex classes, no unprefixed flex", () => {
    const { container } = render(<DashboardNavbar />);
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.className).toMatch(/\bhidden\b/);
    expect(header!.className).toMatch(/\blg:flex\b/);
    // No bare `flex` (unprefixed) — only `lg:flex` for desktop
    const classes = header!.className.split(/\s+/);
    expect(classes).not.toContain("flex");
    expect(classes).toContain("hidden");
    expect(classes).toContain("lg:flex");
  });

  it("forwards initialNotifications and onNotificationsRead to NotificationBell", () => {
    const initialData = [
      {
        id: "n1",
        title: "Pre-loaded",
        body: "Body",
        link: null,
        type: "RESERVATION_CREATED",
        createdAt: new Date().toISOString(),
        isRead: false,
      },
    ];
    const onNotificationsRead = vi.fn();

    render(
      <DashboardNavbar
        notificationUnreadCount={3}
        initialNotifications={initialData}
        onNotificationsRead={onNotificationsRead}
      />
    );

    expect(vi.mocked(mockNotificationBell)).toHaveBeenCalled();
    const firstCall = vi.mocked(mockNotificationBell).mock.calls[0][0];
    expect(firstCall).toMatchObject({
      unreadCount: 3,
      initialNotifications: initialData,
      onNotificationsRead,
    });
  });
});
