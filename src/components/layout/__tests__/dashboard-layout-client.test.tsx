import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardLayoutClient } from "../dashboard-layout-client";

const { mockGetUnreadCount, mockMarkAll, mockGetRecent } = vi.hoisted(() => ({
  mockGetUnreadCount: vi.fn().mockResolvedValue(0),
  mockMarkAll: vi.fn().mockResolvedValue({ success: true, count: 3 }),
  mockGetRecent: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/actions/notifications", () => ({
  getUnreadNotificationCount: mockGetUnreadCount,
  markAllNotificationsAsRead: mockMarkAll,
  getRecentNotifications: mockGetRecent,
}));

vi.mock("@/components/layout/dashboard-sidebar", () => ({
  DashboardSidebar: vi.fn(() => <div data-testid="sidebar" />),
}));

vi.mock("@/components/layout/dashboard-navbar", () => ({
  DashboardNavbar: vi.fn(({ notificationUnreadCount }: { notificationUnreadCount?: number }) => (
    <div data-testid="navbar" data-count={notificationUnreadCount} />
  )),
}));

describe("DashboardLayoutClient", () => {
  beforeEach(() => {
    mockGetUnreadCount.mockClear().mockResolvedValue(0);
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

  it("does not call getUnreadNotificationCount on mount (initial count comes from prop)", () => {
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

    // getUnreadNotificationCount should NOT be called on mount — the count
    // is provided by the server via the notificationUnreadCount prop
    expect(mockGetUnreadCount).not.toHaveBeenCalled();
  });

  it("calls getUnreadNotificationCount on window focus event", async () => {
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

    mockGetUnreadCount.mockClear();

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalled();
    });
  });

  it("calls getUnreadNotificationCount on visibilitychange when document is visible", async () => {
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

    mockGetUnreadCount.mockClear();

    // jsdom defaults to visible; dispatch visibilitychange
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(mockGetUnreadCount).toHaveBeenCalled();
    });
  });
});
