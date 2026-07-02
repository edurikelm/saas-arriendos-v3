import { describe, expect, it } from "vitest";
import {
  selectRemindersForDispatch,
  milestoneFromDays,
  type ReminderPayment,
} from "@/lib/notifications/select-reminders-for-dispatch";

function buildPayment(overrides: Partial<ReminderPayment> & { dueDateStr?: string } = {}): ReminderPayment {
  return {
    id: "pay-1",
    status: "PENDING",
    paymentType: "RESERVATION",
    dueDate: overrides.dueDateStr ?? "2026-05-20",
    reservation: {
      id: "res-1",
      status: "CONFIRMED",
      client: { name: "Juan Perez" },
      property: { name: "Depto Centro" },
    },
    ...overrides,
  } as ReminderPayment;
}

/**
 * Helper to create a Date that represents a calendar date in Santiago timezone.
 * Santiago is UTC-3 (summer) or UTC-4 (winter).
 * We use a fixed offset of UTC-4 (winter) for our tests, which is valid for May.
 *
 * To get May 20 in Santiago at 12:00 local:
 * - 12:00 SCL = 16:00 UTC (UTC-4)
 * - So: new Date("2026-05-20T16:00:00.000Z")
 */
function sclDateTime(year: number, month: number, day: number, hour = 12): Date {
  // month is 1-indexed for this helper
  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  const hourStr = String(hour).padStart(2, "0");
  // Santiago winter = UTC-4, so midday SCL = 16:00 UTC
  return new Date(`${year}-${monthStr}-${dayStr}T${hourStr}:00:00.000Z`);
}

describe("milestoneFromDays", () => {
  it("returns correct milestone for each valid daysFromToday", () => {
    expect(milestoneFromDays(3)).toBe("BEFORE_3_DAYS");
    expect(milestoneFromDays(1)).toBe("BEFORE_1_DAY");
    expect(milestoneFromDays(0)).toBe("DUE_TODAY");
    expect(milestoneFromDays(-1)).toBe("OVERDUE_1_DAY");
    expect(milestoneFromDays(-3)).toBe("OVERDUE_3_DAYS");
    expect(milestoneFromDays(-7)).toBe("OVERDUE_7_DAYS");
  });

  it("returns null for days outside milestone windows", () => {
    expect(milestoneFromDays(2)).toBeNull();
    expect(milestoneFromDays(4)).toBeNull();
    expect(milestoneFromDays(-2)).toBeNull();
    expect(milestoneFromDays(-8)).toBeNull();
    expect(milestoneFromDays(-15)).toBeNull();
  });
});

describe("selectRemindersForDispatch", () => {
  describe("milestone matching", () => {
    it("emits BEFORE_3_DAYS when dueDate is exactly 3 days ahead", () => {
      // May 20 at midday SCL → May 17 midday SCL is 3 days before
      const now = sclDateTime(2026, 5, 17);
      const payments = [buildPayment({ id: "pay-1", dueDateStr: "2026-05-20T12:00:00.000Z" })];

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(1);
      expect(result[0].milestone).toBe("BEFORE_3_DAYS");
      expect(result[0].notificationKey).toBe("payment-reminder:pay-1:BEFORE_3_DAYS");
    });

    it("emits DUE_TODAY when dueDate is same calendar day", () => {
      const now = sclDateTime(2026, 5, 20);
      const payments = [buildPayment({ id: "pay-1", dueDateStr: "2026-05-20T12:00:00.000Z" })];

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(1);
      expect(result[0].milestone).toBe("DUE_TODAY");
    });

    it("emits OVERDUE_1_DAY when dueDate was exactly 1 day ago", () => {
      const now = sclDateTime(2026, 5, 21);
      const payments = [buildPayment({ id: "pay-1", dueDateStr: "2026-05-20T12:00:00.000Z" })];

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(1);
      expect(result[0].milestone).toBe("OVERDUE_1_DAY");
    });

    it("emits multiple milestones for multiple payments", () => {
      const now = sclDateTime(2026, 5, 20);
      const payments = [
        buildPayment({ id: "pay-today", dueDateStr: "2026-05-20T12:00:00.000Z" }),
        buildPayment({ id: "pay-minus1", dueDateStr: "2026-05-19T12:00:00.000Z" }),
        buildPayment({ id: "pay-plus3", dueDateStr: "2026-05-23T12:00:00.000Z" }),
      ];

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(3);
      const milestones = new Set(result.map((r) => r.milestone));
      expect(milestones).toContain("DUE_TODAY");
      expect(milestones).toContain("OVERDUE_1_DAY");
      expect(milestones).toContain("BEFORE_3_DAYS");
    });
  });

  describe("business rules filtering", () => {
    it("does NOT emit for COMPLETED payment status", () => {
      const now = sclDateTime(2026, 5, 20);
      const payments = [buildPayment({ id: "pay-1", status: "COMPLETED", dueDateStr: "2026-05-20T12:00:00.000Z" })];

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(0);
    });

    it("does NOT emit for EXTRA paymentType", () => {
      const now = sclDateTime(2026, 5, 20);
      const payments = [buildPayment({ id: "pay-1", paymentType: "EXTRA", dueDateStr: "2026-05-20T12:00:00.000Z" })];

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(0);
    });

    it("does NOT emit for CANCELLED reservation", () => {
      const now = sclDateTime(2026, 5, 20);
      const payments = [
        buildPayment({
          id: "pay-1",
          dueDateStr: "2026-05-20T12:00:00.000Z",
          reservation: { id: "res-1", status: "CANCELLED", client: { name: "A" }, property: { name: "B" } },
        }),
      ];

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(0);
    });

    it("does NOT emit for COMPLETED reservation", () => {
      const now = sclDateTime(2026, 5, 20);
      const payments = [
        buildPayment({
          id: "pay-1",
          dueDateStr: "2026-05-20T12:00:00.000Z",
          reservation: { id: "res-1", status: "COMPLETED", client: { name: "A" }, property: { name: "B" } },
        }),
      ];

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(0);
    });

    it("does NOT emit when dueDate is null", () => {
      const now = sclDateTime(2026, 5, 20);
      const payments = [buildPayment({ id: "pay-1", dueDate: null })];

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(0);
    });
  });

  describe("deduplication", () => {
    it("skips milestone already in alreadySentKeys", () => {
      const now = sclDateTime(2026, 5, 20);
      const payments = [buildPayment({ id: "pay-1", dueDateStr: "2026-05-20T12:00:00.000Z" })];
      const alreadySent = new Set(["payment-reminder:pay-1:DUE_TODAY"]);

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", alreadySent);

      expect(result).toHaveLength(0);
    });

    it("emits milestone not in alreadySentKeys", () => {
      const now = sclDateTime(2026, 5, 20);
      const payments = [buildPayment({ id: "pay-1", dueDateStr: "2026-05-20T12:00:00.000Z" })];
      const alreadySent = new Set(["payment-reminder:pay-1:BEFORE_3_DAYS"]);

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", alreadySent);

      expect(result).toHaveLength(1);
      expect(result[0].milestone).toBe("DUE_TODAY");
    });
  });

  describe("timezone boundary", () => {
    it("respects timezone cut-off at midnight SCL", () => {
      // now is 00:30 SCL May 20 (04:30 UTC)
      // dueDate is 23:00 SCL May 19 (03:00 UTC May 20)
      // Actually in May Santiago (UTC-4): 23:00 SCL = 03:00 UTC next day
      // So dueDate May 19 23:00 SCL = May 20 03:00 UTC
      const now = new Date("2026-05-20T04:30:00.000Z"); // 00:30 SCL May 20
      const dueDate = new Date("2026-05-20T03:00:00.000Z"); // 23:00 SCL May 19 (UTC-4)

      const payments = [
        buildPayment({ id: "pay-boundary", dueDate: dueDate.toISOString() }),
      ];

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      // dueDate is May 19 23:00 SCL, now is May 20 00:30 SCL → 1 day overdue
      expect(result).toHaveLength(1);
      expect(result[0].milestone).toBe("OVERDUE_1_DAY");
    });
  });

  describe("out of milestone range", () => {
    it("does NOT emit when payment is 8 days overdue", () => {
      const now = sclDateTime(2026, 5, 28);
      const payments = [buildPayment({ id: "pay-1", dueDateStr: "2026-05-20T12:00:00.000Z" })]; // 8 days ago

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(0);
    });

    it("does NOT emit when payment is 5 days in future (not a milestone)", () => {
      const now = sclDateTime(2026, 5, 15);
      const payments = [buildPayment({ id: "pay-1", dueDateStr: "2026-05-20T12:00:00.000Z" })]; // 5 days ahead

      const result = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());

      expect(result).toHaveLength(0);
    });
  });
});
