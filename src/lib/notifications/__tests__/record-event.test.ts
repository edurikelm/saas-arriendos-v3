import { describe, expect, it, vi, beforeEach } from "vitest";

const mockInAppDispatch = vi.fn();
const mockEmailDispatch = vi.fn();

vi.mock("@/lib/notifications/in-app-channel", () => ({
  inAppChannel: { dispatch: mockInAppDispatch },
}));

vi.mock("@/lib/notifications/email-channel", () => ({
  emailChannel: { dispatch: mockEmailDispatch },
}));

describe("recordDomainEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("RESERVATION_CREATED dispatches to inAppChannel with correct intent", async () => {
    const { recordDomainEvent } = await import("@/lib/notifications/record-event");

    mockInAppDispatch.mockResolvedValue({ ok: true, notificationId: "notif-1", deduplicated: false });
    mockEmailDispatch.mockResolvedValue({ ok: true, notificationId: "notif-1", deduplicated: false });

    await recordDomainEvent({
      type: "RESERVATION_CREATED",
      reservationId: "res-123",
      ownerId: "user-1",
      ownerEmail: "owner@test.com",
      ownerName: "Carlos",
      clientName: "Juan",
      propertyName: "Casa",
    });

    expect(mockInAppDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationKey: "reservation-created:res-123",
        type: "RESERVATION_CREATED",
        title: expect.stringContaining("Juan"),
        body: expect.stringContaining("Juan"),
        link: "/reservations/res-123",
        userId: "user-1",
      }),
      expect.objectContaining({
        userId: "user-1",
        email: "owner@test.com",
        name: "Carlos",
      }),
    );
  });

  it("RESERVATION_CREATED dispatches to emailChannel with same intent and owner recipient", async () => {
    const { recordDomainEvent } = await import("@/lib/notifications/record-event");

    mockInAppDispatch.mockResolvedValue({ ok: true, notificationId: "notif-1", deduplicated: false });
    mockEmailDispatch.mockResolvedValue({ ok: true, notificationId: "notif-1", deduplicated: false });

    await recordDomainEvent({
      type: "RESERVATION_CREATED",
      reservationId: "res-123",
      ownerId: "user-1",
      ownerEmail: "owner@test.com",
      clientName: "Juan",
      propertyName: "Casa",
    });

    expect(mockEmailDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationKey: "reservation-created:res-123",
        type: "RESERVATION_CREATED",
        link: "/reservations/res-123",
        userId: "user-1",
      }),
      expect.objectContaining({
        userId: "user-1",
        email: "owner@test.com",
      }),
    );
  });

  it("calls InAppChannel before EmailChannel (sequential order)", async () => {
    const { recordDomainEvent } = await import("@/lib/notifications/record-event");

    mockInAppDispatch.mockResolvedValue({ ok: true, notificationId: "notif-1", deduplicated: false });
    mockEmailDispatch.mockResolvedValue({ ok: true, notificationId: "notif-1", deduplicated: false });

    await recordDomainEvent({
      type: "RESERVATION_CREATED",
      reservationId: "res-123",
      ownerId: "user-1",
      ownerEmail: "owner@test.com",
      clientName: "Juan",
      propertyName: "Casa",
    });

    const inAppCall = vi.mocked(mockInAppDispatch).mock;
    const emailCall = vi.mocked(mockEmailDispatch).mock;
    expect(inAppCall.invocationCallOrder[0]).toBeLessThan(emailCall.invocationCallOrder[0]);
  });

  it("stops and returns early if InAppChannel fails (email not called)", async () => {
    const { recordDomainEvent } = await import("@/lib/notifications/record-event");

    mockInAppDispatch.mockResolvedValue({ ok: false, error: "DB error" });
    mockEmailDispatch.mockResolvedValue({ ok: true, skipped: "no-api-key" } as any);

    await recordDomainEvent({
      type: "RESERVATION_CREATED",
      reservationId: "res-123",
      ownerId: "user-1",
      ownerEmail: "owner@test.com",
      clientName: "Juan",
      propertyName: "Casa",
    });

    expect(mockEmailDispatch).not.toHaveBeenCalled();
  });

  it("logs error but does not throw when EmailChannel fails", async () => {
    const { recordDomainEvent } = await import("@/lib/notifications/record-event");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockInAppDispatch.mockResolvedValue({ ok: true, notificationId: "notif-1", deduplicated: false });
    mockEmailDispatch.mockResolvedValue({ ok: false, error: "SMTP error" });

    await expect(
      recordDomainEvent({
        type: "RESERVATION_CREATED",
        reservationId: "res-123",
        ownerId: "user-1",
        ownerEmail: "owner@test.com",
        clientName: "Juan",
        propertyName: "Casa",
      }),
    ).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Email failed"),
      expect.objectContaining({ ok: false, error: "SMTP error" }),
    );
    consoleSpy.mockRestore();
  });

  it("does not throw when an unexpected exception occurs", async () => {
    const { recordDomainEvent } = await import("@/lib/notifications/record-event");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockInAppDispatch.mockRejectedValue(new Error("Unexpected crash"));

    await expect(
      recordDomainEvent({
        type: "RESERVATION_CREATED",
        reservationId: "res-123",
        ownerId: "user-1",
        ownerEmail: "owner@test.com",
        clientName: "Juan",
        propertyName: "Casa",
      }),
    ).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });
});
