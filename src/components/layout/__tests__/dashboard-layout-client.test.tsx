import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardLayoutClient } from "../dashboard-layout-client";

const { mockGetUnreadStatus, mockMarkAll, mockGetRecent, mockPlaySound, mockSoundEnabled } = vi.hoisted(
  () => ({
    mockGetUnreadStatus: vi.fn().mockResolvedValue({ count: 0, latestUnreadAt: null }),
    mockMarkAll: vi.fn().mockResolvedValue({ success: true, count: 3 }),
    mockGetRecent: vi.fn().mockResolvedValue([]),
    mockPlaySound: vi.fn(),
    mockSoundEnabled: vi.fn().mockReturnValue(true),
  }),
);

vi.mock("@/lib/actions/notifications", () => ({
  getUnreadNotificationStatus: mockGetUnreadStatus,
  markAllNotificationsAsRead: mockMarkAll,
  getRecentNotifications: mockGetRecent,
}));

vi.mock("@/lib/notifications/notification-sound", () => ({
  playNotificationSound: mockPlaySound,
  primeNotificationSound: vi.fn(),
  isNotificationSoundEnabled: mockSoundEnabled,
  setNotificationSoundEnabled: vi.fn(),
}));

vi.mock("@/components/layout/dashboard-sidebar", () => ({
  DashboardSidebar: vi.fn(() => <div data-testid="sidebar" />),
}));

vi.mock("@/components/layout/dashboard-navbar", () => ({
  DashboardNavbar: vi.fn(
    ({ notificationUnreadCount, notificationRingKey }: { notificationUnreadCount?: number; notificationRingKey?: number }) => (
      <div data-testid="navbar" data-count={notificationUnreadCount} data-ring={notificationRingKey} />
    ),
  ),
}));

describe("DashboardLayoutClient", () => {
  beforeEach(() => {
    mockGetUnreadStatus.mockClear().mockResolvedValue({ count: 0, latestUnreadAt: null });
    mockPlaySound.mockClear();
    mockSoundEnabled.mockClear().mockReturnValue(true);
    mockMarkAll.mockClear().mockResolvedValue({ success: true, count: 3 });
    mockGetRecent.mockClear().mockResolvedValue([]);
  });

  it("initializes liveNotificationUnreadCount from notificationUnreadCount prop", () => {
    render(
      <DashboardLayoutClient
        notificationUnreadCount={7}
        userName="testuser"
        userRole="OWNER"
        userPlan="PRO"
      >
        <div>content</div>
      </DashboardLayoutClient>
    );

    // Navbar receives the count from prop
    const navbar = screen.getByTestId("navbar");
    expect(navbar.getAttribute("data-count")).toBe("7");
  });

  it("passes liveNotificationUnreadCount to DashboardNavbar", () => {
    render(
      <DashboardLayoutClient
        notificationUnreadCount={3}
        userName="testuser"
        userRole="OWNER"
        userPlan="PRO"
      >
        <div>content</div>
      </DashboardLayoutClient>
    );

    const navbar = screen.getByTestId("navbar");
    expect(navbar.getAttribute("data-count")).toBe("3");
  });

  it("does not call getUnreadNotificationStatus on mount (initial count comes from prop)", () => {
    render(
      <DashboardLayoutClient
        notificationUnreadCount={5}
        userName="testuser"
        userRole="OWNER"
        userPlan="PRO"
      >
        <div>content</div>
      </DashboardLayoutClient>
    );

    // getUnreadNotificationStatus should NOT be called on mount — the count
    // is provided by the server via the notificationUnreadCount prop
    expect(mockGetUnreadStatus).not.toHaveBeenCalled();
  });

  it("calls getUnreadNotificationStatus on window focus event", async () => {
    render(
      <DashboardLayoutClient
        notificationUnreadCount={0}
        userName="testuser"
        userRole="OWNER"
        userPlan="PRO"
      >
        <div>content</div>
      </DashboardLayoutClient>
    );

    mockGetUnreadStatus.mockClear();

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(mockGetUnreadStatus).toHaveBeenCalled();
    });
  });

  it("calls getUnreadNotificationStatus on visibilitychange when document is visible", async () => {
    render(
      <DashboardLayoutClient
        notificationUnreadCount={0}
        userName="testuser"
        userRole="OWNER"
        userPlan="PRO"
      >
        <div>content</div>
      </DashboardLayoutClient>
    );

    mockGetUnreadStatus.mockClear();

    // jsdom defaults to visible; dispatch visibilitychange
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(mockGetUnreadStatus).toHaveBeenCalled();
    });
  });

  describe("bell ring on new notifications", () => {
    const loaded = [
      {
        id: "n-old",
        title: "Pago recibido",
        body: "",
        link: null,
        type: "PAYMENT_RECEIVED",
        createdAt: "2026-09-18T12:00:00.000Z",
        isRead: false,
      },
    ];

    function renderLayout() {
      return render(
        <DashboardLayoutClient
          notificationUnreadCount={1}
          initialNotifications={loaded}
          userName="testuser"
          userRole="OWNER"
          userPlan="PRO"
        >
          <div>content</div>
        </DashboardLayoutClient>,
      );
    }

    async function poll() {
      window.dispatchEvent(new Event("focus"));
      await waitFor(() => expect(mockGetUnreadStatus).toHaveBeenCalled());
      mockGetUnreadStatus.mockClear();
    }

    function ringKey() {
      return screen.getByTestId("navbar").getAttribute("data-ring");
    }

    it("rings and plays the sound once when a newer unread notification arrives", async () => {
      renderLayout();
      mockGetUnreadStatus.mockResolvedValue({ count: 2, latestUnreadAt: "2026-09-18T12:05:00.000Z" });

      await poll();

      await waitFor(() => expect(ringKey()).toBe("1"));
      expect(screen.getByTestId("navbar").getAttribute("data-count")).toBe("2");
      expect(mockPlaySound).toHaveBeenCalledTimes(1);

      // Same notification on the next poll: no second ring.
      await poll();
      expect(ringKey()).toBe("1");
      expect(mockPlaySound).toHaveBeenCalledTimes(1);
    });

    it("does not ring for unread notifications that were already there on load", async () => {
      renderLayout();
      mockGetUnreadStatus.mockResolvedValue({ count: 1, latestUnreadAt: "2026-09-18T12:00:00.000Z" });

      await poll();

      expect(ringKey()).toBe("0");
      expect(mockPlaySound).not.toHaveBeenCalled();
    });

    it("rings even when the count did not change (one read elsewhere, one new)", async () => {
      renderLayout();
      mockGetUnreadStatus.mockResolvedValue({ count: 1, latestUnreadAt: "2026-09-18T12:05:00.000Z" });

      await poll();

      await waitFor(() => expect(ringKey()).toBe("1"));
    });

    it("animates but stays silent when the sound is muted on this device", async () => {
      mockSoundEnabled.mockReturnValue(false);
      renderLayout();
      mockGetUnreadStatus.mockResolvedValue({ count: 2, latestUnreadAt: "2026-09-18T12:05:00.000Z" });

      await poll();

      await waitFor(() => expect(ringKey()).toBe("1"));
      expect(mockPlaySound).not.toHaveBeenCalled();
    });

    it("plays the sound once even though two bells are mounted (mobile + desktop)", async () => {
      renderLayout();
      mockGetUnreadStatus.mockResolvedValue({ count: 2, latestUnreadAt: "2026-09-18T12:05:00.000Z" });

      await poll();

      await waitFor(() => expect(ringKey()).toBe("1"));
      // The mobile bar renders the real bell; it animates from the same key.
      const icon = screen.getByTestId("notification-bell-icon");
      expect(icon.classList.contains("notification-bell-ring")).toBe(true);
      expect(mockPlaySound).toHaveBeenCalledTimes(1);
    });
  });
});
