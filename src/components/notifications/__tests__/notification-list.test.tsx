import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationList } from "../notification-list";

const { mockGetRecent, mockMarkAll } = vi.hoisted(() => ({
  mockGetRecent: vi.fn(),
  mockMarkAll: vi.fn(),
}));

vi.mock("@/lib/actions/notifications", () => ({
  getRecentNotifications: mockGetRecent,
  markAllNotificationsAsRead: mockMarkAll,
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

describe("NotificationList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state with BellOff icon and message when no notifications", async () => {
    mockGetRecent.mockResolvedValue([]);

    render(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText("No tienes notificaciones")).toBeTruthy();
    });
  });

  it("renders notification rows with title and body", async () => {
    const now = new Date();
    mockGetRecent.mockResolvedValue([
      {
        id: "notif-1",
        title: "Pago recibido",
        body: "Juan pagó $100.000",
        link: "/payments/pay-1",
        type: "PAYMENT_RECEIVED",
        createdAt: now.toISOString(),
        isRead: false,
      },
      {
        id: "notif-2",
        title: "Nueva reserva",
        body: "María reservó Depto Centro",
        link: null,
        type: "RESERVATION_CREATED",
        createdAt: new Date(now.getTime() - 3600000).toISOString(),
        isRead: true,
      },
    ]);

    render(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText("Pago recibido")).toBeTruthy();
    });
    expect(screen.getByText("Juan pagó $100.000")).toBeTruthy();
    expect(screen.getByText("Nueva reserva")).toBeTruthy();
    expect(screen.getByText("María reservó Depto Centro")).toBeTruthy();
  });

  it("shows unread dot indicator for unread notifications", async () => {
    mockGetRecent.mockResolvedValue([
      {
        id: "notif-1",
        title: "Test",
        body: "Body",
        link: null,
        type: "RESERVATION_CREATED",
        createdAt: new Date().toISOString(),
        isRead: false,
      },
    ]);

    render(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText("Test")).toBeTruthy();
    });
    const unreadDot = document.querySelector("span[aria-label='No leída']");
    expect(unreadDot).toBeTruthy();
  });

  it("does not show unread dot for read notifications", async () => {
    mockGetRecent.mockResolvedValue([
      {
        id: "notif-1",
        title: "Test",
        body: "Body",
        link: null,
        type: "RESERVATION_CREATED",
        createdAt: new Date().toISOString(),
        isRead: true,
      },
    ]);

    render(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText("Test")).toBeTruthy();
    });
    const unreadDot = document.querySelector("span[aria-label='No leída']");
    expect(unreadDot).toBeNull();
  });

  it("renders 'Marcar todas como leídas' button when there are notifications", async () => {
    mockGetRecent.mockResolvedValue([
      {
        id: "notif-1",
        title: "Test",
        body: "Body",
        link: null,
        type: "RESERVATION_CREATED",
        createdAt: new Date().toISOString(),
        isRead: false,
      },
    ]);

    render(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText("Marcar todas como leídas")).toBeTruthy();
    });
  });

  it("does not render 'Marcar todas como leídas' button when empty", async () => {
    mockGetRecent.mockResolvedValue([]);

    render(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText("No tienes notificaciones")).toBeTruthy();
    });
    expect(screen.queryByText("Marcar todas como leídas")).toBeNull();
  });

  it("initialNotifications suppresses mount fetch — does not call getRecentNotifications", async () => {
    const initialData = [
      {
        id: "n1",
        title: "From server",
        body: "Pre-loaded",
        link: null,
        type: "RESERVATION_CREATED",
        createdAt: new Date().toISOString(),
        isRead: false,
      },
    ];

    render(<NotificationList initialNotifications={initialData} />);

    // Should render immediately with initial data, no fetch needed
    await waitFor(() => {
      expect(screen.getByText("From server")).toBeTruthy();
    });
    expect(mockGetRecent).not.toHaveBeenCalled();
  });

  it("shows initial data without loader when initialNotifications provided", async () => {
    const initialData = [
      {
        id: "n1",
        title: "Immediate",
        body: "No loading state",
        link: null,
        type: "PAYMENT_RECEIVED",
        createdAt: new Date().toISOString(),
        isRead: true,
      },
    ];

    render(<NotificationList initialNotifications={initialData} />);

    // No Loader2 should appear — data is already present
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Immediate")).toBeTruthy();
  });

  // Note: initialNotifications={null} is not a realistic scenario in the app flow —
  // the layout always passes an array (possibly empty). The mount fetch is covered
  // by the "shows empty state" test which exercises initialNotifications=undefined path.
});