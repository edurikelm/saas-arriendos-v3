import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    notification: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("InAppChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new notification when key does not exist", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { InAppChannel } = await import("@/lib/notifications/in-app-channel");

    const channel = new InAppChannel();

    vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: "notif-1",
      notificationKey: "payment-received:pay_123",
      userId: "user-1",
      type: "PAYMENT_RECEIVED" as const,
      title: "Pago recibido",
      body: "Se recibió un pago",
      link: null,
      createdAt: new Date(),
      deliveredAt: null,
    });

    const intent = {
      notificationKey: "payment-received:pay_123",
      type: "PAYMENT_RECEIVED" as const,
      title: "Pago recibido",
      body: "Se recibió un pago",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, { userId: "user-1", email: "a@b.com" });

    expect(result).toEqual({ ok: true, notificationId: "notif-1", deduplicated: false });
    expect(prisma.notification.findUnique).toHaveBeenCalledWith({
      where: { notificationKey: "payment-received:pay_123" },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        notificationKey: "payment-received:pay_123",
        userId: "user-1",
        type: "PAYMENT_RECEIVED",
        title: "Pago recibido",
        body: "Se recibió un pago",
        link: null,
      },
    });
  });

  it("returns deduplicated result when key already exists", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { InAppChannel } = await import("@/lib/notifications/in-app-channel");

    const channel = new InAppChannel();

    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: "existing-notif",
      notificationKey: "payment-received:pay_123",
      userId: "user-1",
      type: "PAYMENT_RECEIVED" as const,
      title: "Pago recibido",
      body: "Se recibió un pago",
      link: null,
      createdAt: new Date(),
      deliveredAt: null,
    });

    const intent = {
      notificationKey: "payment-received:pay_123",
      type: "PAYMENT_RECEIVED" as const,
      title: "Pago recibido",
      body: "Se recibió un pago",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, { userId: "user-1", email: "a@b.com" });

    expect(result).toEqual({ ok: true, notificationId: "existing-notif", deduplicated: true });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("returns error result on database failure", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { InAppChannel } = await import("@/lib/notifications/in-app-channel");

    const channel = new InAppChannel();

    vi.mocked(prisma.notification.findUnique).mockRejectedValue(new Error("DB connection failed"));

    const intent = {
      notificationKey: "payment-received:pay_123",
      type: "PAYMENT_RECEIVED" as const,
      title: "Pago recibido",
      body: "Se recibió un pago",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, { userId: "user-1", email: "a@b.com" });

    expect(result).toEqual({ ok: false, error: "DB connection failed" });
  });

  it("passes link if provided", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { InAppChannel } = await import("@/lib/notifications/in-app-channel");

    const channel = new InAppChannel();

    vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: "notif-1",
      notificationKey: "payment-received:pay_123",
      userId: "user-1",
      type: "PAYMENT_RECEIVED" as const,
      title: "Pago recibido",
      body: "Se recibió un pago",
      link: null,
      createdAt: new Date(),
      deliveredAt: null,
    });

    const intent = {
      notificationKey: "payment-received:pay_123",
      type: "PAYMENT_RECEIVED" as const,
      title: "Pago recibido",
      body: "Se recibió un pago",
      link: "/payments/pay_123",
      userId: "user-1",
    };

    await channel.dispatch(intent, { userId: "user-1", email: "a@b.com" });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ link: "/payments/pay_123" }),
    });
  });
});
