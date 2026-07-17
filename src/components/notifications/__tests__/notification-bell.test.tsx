import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "../notification-bell";

const { mockMarkAll, mockGetRecent } = vi.hoisted(() => ({
  mockMarkAll: vi.fn().mockResolvedValue({ success: true, count: 5 }),
  mockGetRecent: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/actions/notifications", () => ({
  markAllNotificationsAsRead: mockMarkAll,
  getRecentNotifications: mockGetRecent,
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
    mockGetRecent.mockClear().mockResolvedValue([]);
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

  it("calls markAllNotificationsAsRead when popover opens with unreadCount > 0", async () => {
    const user = userEvent.setup();

    render(<NotificationBell unreadCount={5} />);
    const bell = screen.getByLabelText("Notificaciones");

    await act(async () => {
      await user.click(bell);
    });

    expect(mockMarkAll).toHaveBeenCalled();
  });

  it("does NOT call markAllNotificationsAsRead when unreadCount is 0", async () => {
    const user = userEvent.setup();

    render(<NotificationBell unreadCount={0} />);
    const bell = screen.getByLabelText("Notificaciones");

    await act(async () => {
      await user.click(bell);
    });

    expect(mockMarkAll).not.toHaveBeenCalled();
  });

  it("calls onNotificationsRead callback when mark succeeds with count > 0", async () => {
    const user = userEvent.setup();
    const onNotificationsRead = vi.fn();

    render(<NotificationBell unreadCount={5} onNotificationsRead={onNotificationsRead} />);
    const bell = screen.getByLabelText("Notificaciones");

    await act(async () => {
      await user.click(bell);
    });

    await waitFor(() => {
      expect(onNotificationsRead).toHaveBeenCalled();
    });
  });

  it("does NOT call onNotificationsRead when unreadCount is 0", async () => {
    const user = userEvent.setup();
    const onNotificationsRead = vi.fn();

    render(<NotificationBell unreadCount={0} onNotificationsRead={onNotificationsRead} />);
    const bell = screen.getByLabelText("Notificaciones");

    await act(async () => {
      await user.click(bell);
    });

    // onNotificationsRead should not be called when count is 0
    expect(onNotificationsRead).not.toHaveBeenCalled();
  });

  it("refreshes notification list in background on open and calls onNotificationsRead when count > 0", async () => {
    const user = userEvent.setup();
    const initialData = [
      {
        id: "n1",
        title: "From layout",
        body: "Pre-loaded",
        link: null,
        type: "RESERVATION_CREATED",
        createdAt: new Date().toISOString(),
        isRead: false,
      },
    ];
    const refreshedData = [
      {
        id: "n2",
        title: "Fresh from server",
        body: "After refresh",
        link: null,
        type: "PAYMENT_RECEIVED",
        createdAt: new Date().toISOString(),
        isRead: false,
      },
    ];
    const onNotificationsRead = vi.fn();

    mockGetRecent.mockResolvedValue(refreshedData);

    render(
      <NotificationBell
        unreadCount={3}
        initialNotifications={initialData}
        onNotificationsRead={onNotificationsRead}
      />
    );
    const bell = screen.getByLabelText("Notificaciones");

    await act(async () => {
      await user.click(bell);
    });

    // Background refresh must be requested on open — exactly once (no mount fetch from NotificationList)
    await waitFor(() => {
      expect(mockGetRecent).toHaveBeenCalledTimes(1);
    });

    // After refresh resolves, list shows the fresh data
    await waitFor(() => {
      expect(screen.getByText("Fresh from server")).toBeTruthy();
    });

    // Mark succeeds → rows marked as read locally → unread dot disappears
    await waitFor(() => {
      expect(onNotificationsRead).toHaveBeenCalled();
    });
    // The fresh data had isRead:false, but after mark the local rows are marked isRead:true
    // so no unread dot should remain in the list
    await waitFor(() => {
      expect(document.querySelector("span[aria-label='No leída']")).toBeNull();
    });
  });
});
