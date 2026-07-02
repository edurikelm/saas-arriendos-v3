import { describe, expect, it } from "vitest";
import { renderNotification, type NotificationRenderData } from "@/lib/notifications/render-notification";

function render(data: NotificationRenderData, format: "in-app" | "email" = "email") {
  return renderNotification(data, format);
}

describe("renderNotification", () => {
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

      expect(result.html).toContain("/reservations/res-123");
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
