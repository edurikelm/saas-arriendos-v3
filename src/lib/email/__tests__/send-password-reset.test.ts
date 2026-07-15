import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn(function () {
    return { emails: { send: mockSend } };
  }),
}));

describe("sendPasswordResetEmail", () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFromEmail = process.env.RESEND_FROM_EMAIL;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_testkey";
    process.env.RESEND_FROM_EMAIL = "noreply@example.com";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalApiKey ?? "";
    if (originalFromEmail !== undefined) {
      process.env.RESEND_FROM_EMAIL = originalFromEmail;
    } else {
      delete process.env.RESEND_FROM_EMAIL;
    }
    if (originalAppUrl !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    } else {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  it("envía el email con el link de reset", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });

    const { sendPasswordResetEmail } = await import("../send-password-reset");
    const result = await sendPasswordResetEmail({
      to: "user@example.com",
      resetUrl: "http://localhost:3000/reset-password?token=abc123",
    });

    expect(result).toEqual({ sent: true, emailId: "email-123" });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: expect.stringContaining("Restablecer"),
        html: expect.stringContaining("http://localhost:3000/reset-password?token=abc123"),
      }),
    );
  });

  it("retorna sent:false con reason 'no-api-key' cuando RESEND_API_KEY falta", async () => {
    delete process.env.RESEND_API_KEY;

    const { sendPasswordResetEmail } = await import("../send-password-reset");
    const result = await sendPasswordResetEmail({
      to: "user@example.com",
      resetUrl: "http://localhost:3000/reset-password?token=abc123",
    });

    expect(result).toEqual({ sent: false, reason: "no-api-key" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("retorna sent:false con reason 'no-api-key' cuando RESEND_FROM_EMAIL falta", async () => {
    delete process.env.RESEND_FROM_EMAIL;

    const { sendPasswordResetEmail } = await import("../send-password-reset");
    const result = await sendPasswordResetEmail({
      to: "user@example.com",
      resetUrl: "http://localhost:3000/reset-password?token=abc123",
    });

    expect(result).toEqual({ sent: false, reason: "no-api-key" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("retorna sent:false con reason 'resend-error' cuando Resend devuelve error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Domain not verified" },
    });

    const { sendPasswordResetEmail } = await import("../send-password-reset");
    const result = await sendPasswordResetEmail({
      to: "user@example.com",
      resetUrl: "http://localhost:3000/reset-password?token=abc123",
    });

    expect(result).toEqual({ sent: false, reason: "resend-error", error: "Domain not verified" });
  });

  it("retorna sent:false con reason 'exception' cuando Resend lanza excepción", async () => {
    mockSend.mockRejectedValue(new Error("Network timeout"));

    const { sendPasswordResetEmail } = await import("../send-password-reset");
    const result = await sendPasswordResetEmail({
      to: "user@example.com",
      resetUrl: "http://localhost:3000/reset-password?token=abc123",
    });

    expect(result).toEqual({ sent: false, reason: "exception", error: "Network timeout" });
  });
});
