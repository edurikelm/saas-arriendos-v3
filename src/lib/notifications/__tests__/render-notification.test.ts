import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  renderNotification,
  renderNotificationEmail,
  type NotificationRenderData,
} from "@/lib/notifications/render-notification";

function render(data: NotificationRenderData, format: "in-app" | "email" = "email") {
  return renderNotification(data, format);
}

describe("renderNotification", () => {
  // Email links are absolute (see renderNotificationEmail).
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.rentalpro.cl";
  });
  afterEach(() => {
    if (originalAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    else delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe("RESERVATION_CREATED", () => {
    it("renders subject with client and property names", () => {
      const result = render({
        type: "RESERVATION_CREATED",
        clientName: "Juan Perez",
        propertyName: "Depto Centro",
        reservationId: "res-123",
      });

      expect(result.subject).toBe("Nueva reserva: Juan Perez en Depto Centro");
      expect(result.text).toContain("Juan Perez");
      expect(result.text).toContain("Depto Centro");
    });

    it("handles missing optional fields", () => {
      const result = render({ type: "RESERVATION_CREATED" });
      expect(result.subject).toBe("Nueva reserva: un cliente en una propiedad");
    });

    it("includes link in HTML when reservationId is provided", () => {
      const result = render({
        type: "RESERVATION_CREATED",
        reservationId: "res-123",
      });

      expect(result.html).toContain('href="https://app.rentalpro.cl/reservations/res-123"');
    });
  });

  describe("RESERVATION_CANCELLED", () => {
    it("renders correct subject", () => {
      const result = render({
        type: "RESERVATION_CANCELLED",
        clientName: "María López",
        propertyName: "Cabaña Sur",
        reservationId: "res-456",
      });

      expect(result.subject).toBe("Reserva cancelada: María López en Cabaña Sur");
    });
  });

  describe("PAYMENT_RECEIVED", () => {
    it("renders subject with amount", () => {
      const result = render({
        type: "PAYMENT_RECEIVED",
        clientName: "Carlos Ruiz",
        amount: "$150.000",
        paymentId: "pay-789",
      });

      expect(result.subject).toBe("Pago recibido: Carlos Ruiz ($150.000)");
    });
  });

  describe("PAYMENT_REMINDER", () => {
    it("renders DUE_TODAY milestone correctly", () => {
      const result = render({
        type: "PAYMENT_REMINDER",
        clientName: "Ana Torres",
        amount: "$80.000",
        milestone: "DUE_TODAY",
        dueDate: "20 de mayo",
        daysFromToday: 0,
      });

      expect(result.subject).toContain("vence hoy");
      expect(result.text).toContain("vence hoy");
      expect(result.text).toContain("$80.000");
    });

    it("renders BEFORE_3_DAYS milestone correctly", () => {
      const result = render({
        type: "PAYMENT_REMINDER",
        clientName: "Ana Torres",
        amount: "$80.000",
        milestone: "BEFORE_3_DAYS",
        daysFromToday: 3,
      });

      expect(result.subject).toContain("3 días");
      expect(result.text).toContain("3 días");
    });

    it("renders OVERDUE_1_DAY milestone correctly", () => {
      const result = render({
        type: "PAYMENT_REMINDER",
        clientName: "Ana Torres",
        amount: "$80.000",
        milestone: "OVERDUE_1_DAY",
        daysFromToday: -1,
      });

      expect(result.subject).toContain("vencido hace 1 día");
    });

    it("renders OVERDUE_7_DAYS milestone correctly", () => {
      const result = render({
        type: "PAYMENT_REMINDER",
        clientName: "Pedro Gómez",
        amount: "$200.000",
        milestone: "OVERDUE_7_DAYS",
        daysFromToday: -7,
      });

      expect(result.subject).toContain("vencido hace 7 días");
    });

    it("falls back gracefully when daysFromToday is undefined", () => {
      const result = render({
        type: "PAYMENT_REMINDER",
        clientName: "Ana Torres",
        amount: "$80.000",
        milestone: "DUE_TODAY",
      });

      expect(result.subject).toBeTruthy();
      expect(result.text).toBeTruthy();
    });
  });

  describe("PAYMENT_FAILED", () => {
    it("renders correct subject and body", () => {
      const result = render({
        type: "PAYMENT_FAILED",
        clientName: "Roberto Díaz",
        amount: "$95.000",
        paymentId: "pay-fail",
      });

      expect(result.subject).toBe("Pago fallido: Roberto Díaz ($95.000)");
      expect(result.text).toContain("no pudo procesarse");
    });
  });

  describe("PAYMENT_REVERTED", () => {
    it("renders correct subject with client and amount", () => {
      const result = render({
        type: "PAYMENT_REVERTED",
        clientName: "María López",
        amount: "$120.000",
        paymentId: "pay-rev-1",
      });

      expect(result.subject).toBe("Pago revertido: María López ($120.000)");
      expect(result.text).toContain("María López");
      expect(result.text).toContain("$120.000");
      expect(result.text).toContain("revirtió");
    });

    it("includes reason in body when provided", () => {
      const result = render({
        type: "PAYMENT_REVERTED",
        clientName: "Carlos Ruiz",
        amount: "$50.000",
        reason: "Cliente solicitó reversa",
      });

      expect(result.text).toContain("Motivo: Cliente solicitó reversa");
    });

    it("renders without reason gracefully", () => {
      const result = render({
        type: "PAYMENT_REVERTED",
        clientName: "Ana Torres",
        amount: "$75.000",
      });

      expect(result.subject).toBeTruthy();
      expect(result.text).toBeTruthy();
    });

    it("links to the reservation (payments have no page of their own)", () => {
      const result = render({
        type: "PAYMENT_REVERTED",
        clientName: "Test",
        amount: "$100",
        paymentId: "pay-123",
        reservationId: "res-9",
      });

      expect(result.html).toContain("https://app.rentalpro.cl/reservations/res-9");
      expect(result.html).not.toContain("/payments/");
    });
  });

  describe("email format", () => {
    it("includes HTML structure with DOCTYPE", () => {
      const result = render({
        type: "RESERVATION_CREATED",
        clientName: "Test",
        propertyName: "Test Property",
        reservationId: "res-1",
      });

      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html>");
      expect(result.html).toContain("<title>");
    });

    it("includes RentalPro footer", () => {
      const result = render({
        type: "PAYMENT_RECEIVED",
        clientName: "Test",
        amount: "$100",
      });

      expect(result.html).toContain("RentalPro");
    });

    it("text format does not include HTML tags", () => {
      const result = render(
        { type: "RESERVATION_CREATED", clientName: "Test", propertyName: "Prop" },
        "email",
      );

      expect(result.text).not.toContain("<");
      expect(result.text).not.toContain(">");
    });
  });

  describe("renderNotificationEmail", () => {
    it("escapes HTML typed into names", () => {
      const result = renderNotificationEmail({
        subject: 'Nueva reserva: <b>Ana</b> en "Casa"',
        body: "Reserva de <script>alert(1)</script> & cía.",
      });

      expect(result.html).not.toContain("<script>");
      expect(result.html).not.toContain("<b>Ana</b>");
      expect(result.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; cía.");
      expect(result.html).toContain("&quot;Casa&quot;");
      // Plain text is not HTML: it stays as typed.
      expect(result.text).toBe("Reserva de <script>alert(1)</script> & cía.");
    });

    it("keeps an already absolute link as is", () => {
      const result = renderNotificationEmail({
        subject: "s",
        body: "b",
        link: "https://www.mercadopago.cl/x",
      });

      expect(result.html).toContain('href="https://www.mercadopago.cl/x"');
    });
  });

  describe("in-app format", () => {
    it("html equals text (no extra wrapping)", () => {
      const result = render(
        { type: "PAYMENT_RECEIVED", clientName: "Test", amount: "$50" },
        "in-app",
      );

      expect(result.html).toBe(result.text);
    });

    it("subject is the title for in-app", () => {
      const result = render(
        {
          type: "RESERVATION_CREATED",
          clientName: "Test",
          propertyName: "Prop",
        },
        "in-app",
      );

      expect(result.subject).toBe("Nueva reserva: Test en Prop");
    });
  });
});
