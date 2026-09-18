import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn(function () {
    return { emails: { send: mockSend } };
  }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    notification: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}));

describe("EmailChannel", () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFromEmail = process.env.RESEND_FROM_EMAIL;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_testkey";
    process.env.RESEND_FROM_EMAIL = "test@example.com";

    // Default: email enabled
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      notificationsEmailEnabled: true,
    } as any);
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalApiKey ?? "";
    if (originalFromEmail !== undefined) {
      process.env.RESEND_FROM_EMAIL = originalFromEmail;
    } else {
      delete process.env.RESEND_FROM_EMAIL;
    }
  });

  it("sends email successfully and updates deliveredAt", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { EmailChannel } = await import("@/lib/notifications/email-channel");

    const channel = new EmailChannel();

    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: "notif-1",
      notificationKey: "reservation-created:res-1",
      userId: "user-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva",
      body: "Se creó una reserva",
      link: "/reservations/res-1",
      createdAt: new Date(),
      deliveredAt: null,
    });

    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    vi.mocked(prisma.notification.update).mockResolvedValue({} as any);

    const intent = {
      notificationKey: "reservation-created:res-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva: Juan en Casa",
      body: "Se creó una nueva reserva para Juan en Casa.",
      link: "/reservations/res-1",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, {
      userId: "user-1",
      email: "owner@test.com",
    });

    expect(result).toEqual({ ok: true, notificationId: "notif-1", deduplicated: false });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@test.com",
        subject: expect.any(String),
      }),
    );
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "notif-1" },
      data: { deliveredAt: expect.any(Date) },
    });
  });

  it("returns error when Resend API returns an error", async () => {
    const { EmailChannel } = await import("@/lib/notifications/email-channel");
    const channel = new EmailChannel();

    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Domain not verified" },
    });

    const intent = {
      notificationKey: "reservation-created:res-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva: Juan en Casa",
      body: "Se creó una nueva reserva para Juan en Casa.",
      link: "/reservations/res-1",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, {
      userId: "user-1",
      email: "owner@test.com",
    });

    expect(result).toEqual({ ok: false, error: "Domain not verified" });
  });

  it("returns error when Resend throws an exception", async () => {
    const { EmailChannel } = await import("@/lib/notifications/email-channel");
    const channel = new EmailChannel();

    mockSend.mockRejectedValue(new Error("Network timeout"));

    const intent = {
      notificationKey: "reservation-created:res-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva: Juan en Casa",
      body: "Se creó una nueva reserva para Juan en Casa.",
      link: "/reservations/res-1",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, {
      userId: "user-1",
      email: "owner@test.com",
    });

    expect(result).toEqual({ ok: false, error: "Network timeout" });
  });

  it("skips without calling Resend when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const { EmailChannel } = await import("@/lib/notifications/email-channel");
    const channel = new EmailChannel();

    const intent = {
      notificationKey: "reservation-created:res-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva",
      body: "Se creó una reserva",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, {
      userId: "user-1",
      email: "owner@test.com",
    });

    expect(result).toEqual({ ok: true, skipped: "no-api-key" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips without calling Resend when RESEND_FROM_EMAIL is missing", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    const originalEmail = process.env.RESEND_FROM_EMAIL;
    process.env.RESEND_API_KEY = "re_abc123";
    delete process.env.RESEND_FROM_EMAIL;

    const { EmailChannel } = await import("@/lib/notifications/email-channel");
    const channel = new EmailChannel();

    const intent = {
      notificationKey: "reservation-created:res-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva",
      body: "Se creó una reserva",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, {
      userId: "user-1",
      email: "owner@test.com",
    });

    expect(result).toEqual({ ok: true, skipped: "no-api-key" });
    expect(mockSend).not.toHaveBeenCalled();

    process.env.RESEND_API_KEY = originalKey ?? "";
    if (originalEmail !== undefined) process.env.RESEND_FROM_EMAIL = originalEmail;
  });

  it("does not overwrite deliveredAt if already set", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { EmailChannel } = await import("@/lib/notifications/email-channel");

    const channel = new EmailChannel();

    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: "notif-1",
      notificationKey: "reservation-created:res-1",
      userId: "user-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva",
      body: "Se creó una reserva",
      link: "/reservations/res-1",
      createdAt: new Date(),
      deliveredAt: new Date("2025-01-01"), // already set
    });

    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });

    const intent = {
      notificationKey: "reservation-created:res-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva",
      body: "Se creó una reserva",
      link: "/reservations/res-1",
      userId: "user-1",
    };

    await channel.dispatch(intent, { userId: "user-1", email: "owner@test.com" });

    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("skips silently when notification row does not exist (retry scenario)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { EmailChannel } = await import("@/lib/notifications/email-channel");

    const channel = new EmailChannel();

    vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });

    const intent = {
      notificationKey: "reservation-created:res-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva",
      body: "Se creó una reserva",
      link: "/reservations/res-1",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, { userId: "user-1", email: "owner@test.com" });

    expect(result).toEqual({ ok: true, skipped: "no-api-key" });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("does NOT call Resend when notificationsEmailEnabled is false", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { EmailChannel } = await import("@/lib/notifications/email-channel");

    const channel = new EmailChannel();

    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      notificationsEmailEnabled: false,
    } as any);

    const intent = {
      notificationKey: "reservation-created:res-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva",
      body: "Se creó una reserva",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, {
      userId: "user-1",
      email: "owner@test.com",
    });

    expect(result).toEqual({ ok: true, skipped: "email-disabled" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("calls Resend when notificationsEmailEnabled is true", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { EmailChannel } = await import("@/lib/notifications/email-channel");

    const channel = new EmailChannel();

    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      notificationsEmailEnabled: true,
    } as any);
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      id: "notif-1",
      notificationKey: "reservation-created:res-1",
      userId: "user-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva",
      body: "Se creó una reserva",
      link: "/reservations/res-1",
      createdAt: new Date(),
      deliveredAt: null,
    });
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    vi.mocked(prisma.notification.update).mockResolvedValue({} as any);

    const intent = {
      notificationKey: "reservation-created:res-1",
      type: "RESERVATION_CREATED" as const,
      title: "Nueva reserva",
      body: "Se creó una reserva",
      link: "/reservations/res-1",
      userId: "user-1",
    };

    const result = await channel.dispatch(intent, {
      userId: "user-1",
      email: "owner@test.com",
    });

    expect(result).toEqual({ ok: true, notificationId: "notif-1", deduplicated: false });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@test.com",
        subject: expect.any(String),
      }),
    );
  });

  describe("email content", () => {
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    beforeEach(async () => {
      const { prisma } = await import("@/lib/db/prisma");
      vi.mocked(prisma.notification.findUnique).mockResolvedValue({
        id: "notif-1",
        deliveredAt: null,
      } as any);
      vi.mocked(prisma.notification.update).mockResolvedValue({} as any);
      mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
      process.env.NEXT_PUBLIC_APP_URL = "https://app.rentalpro.cl";
    });

    afterEach(() => {
      if (originalAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
      else delete process.env.NEXT_PUBLIC_APP_URL;
    });

    async function sendEmail(intent: {
      type: "PAYMENT_RECEIVED" | "SUBSCRIPTION_ACTIVATED";
      title: string;
      body: string;
      link?: string;
    }) {
      const { EmailChannel } = await import("@/lib/notifications/email-channel");
      await new EmailChannel().dispatch(
        { notificationKey: "k", userId: "user-1", ...intent },
        { userId: "user-1", email: "owner@test.com" },
      );
      return mockSend.mock.calls[0][0] as { subject: string; html: string; text: string };
    }

    it("uses the rendered title and body, so client and amount reach the email", async () => {
      // Regression: the channel re-rendered from the type alone and sent
      // "Pago recibido: un cliente (—)".
      const email = await sendEmail({
        type: "PAYMENT_RECEIVED",
        title: "Pago recibido: Juan Pérez (150000)",
        body: "Se registró un pago de 150000 de Juan Pérez.",
        link: "/reservations/res-1",
      });

      expect(email.subject).toBe("Pago recibido: Juan Pérez (150000)");
      expect(email.html).toContain("Se registró un pago de 150000 de Juan Pérez.");
      expect(email.text).toContain("Se registró un pago de 150000 de Juan Pérez.");
      expect(email.html).not.toContain("un cliente");
    });

    it("links with an absolute URL, which a mail client can open", async () => {
      const email = await sendEmail({
        type: "PAYMENT_RECEIVED",
        title: "Pago recibido",
        body: "Se registró un pago.",
        link: "/reservations/res-1",
      });

      expect(email.html).toContain('href="https://app.rentalpro.cl/reservations/res-1"');
      expect(email.text).toContain("https://app.rentalpro.cl/reservations/res-1");
    });

    it("leaves the link out when NEXT_PUBLIC_APP_URL is missing instead of sending a broken one", async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;

      const email = await sendEmail({
        type: "PAYMENT_RECEIVED",
        title: "Pago recibido",
        body: "Se registró un pago.",
        link: "/reservations/res-1",
      });

      expect(email.html).not.toContain("href=");
    });

    it("keeps the subscription copy (it used to fall back to a generic subject)", async () => {
      const email = await sendEmail({
        type: "SUBSCRIPTION_ACTIVATED",
        title: "Tu plan PRO está activo",
        body: "Ahora tienes acceso a iCal, documentos de reserva y propiedades ilimitadas.",
        link: "/settings/billing",
      });

      expect(email.subject).toBe("Tu plan PRO está activo");
      expect(email.html).not.toContain("SUBSCRIPTION_ACTIVATED");
    });
  });
});
