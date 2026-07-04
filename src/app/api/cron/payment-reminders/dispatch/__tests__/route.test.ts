import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectRemindersForDispatch } from "@/lib/notifications/select-reminders-for-dispatch";

const mockPrisma = vi.hoisted(() => ({
  payment: { findMany: vi.fn() },
  notification: { findMany: vi.fn() },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

const mockRecordDomainEvent = vi.fn();
vi.mock("@/lib/notifications/record-event", () => ({
  recordDomainEvent: mockRecordDomainEvent,
}));

function buildPaymentRow(overrides: { id?: string; dueDate?: Date | null; status?: string; ownerId?: string; ownerEmail?: string; ownerName?: string; clientName?: string; amount?: string; reservationStatus?: string; } = {}) {
  const now = new Date();
  const {
    id = "pay-1",
    dueDate = new Date(now.getTime() + 86400000),
    status = "PENDING",
    ownerId = "user-1",
    ownerEmail = "owner@test.com",
    ownerName = "Carlos",
    clientName = "Juan",
    amount = "150000",
    reservationStatus = "CONFIRMED",
  } = overrides;
  return {
    id, status, paymentType: "RESERVATION", dueDate, amount,
    reservation: {
      id: "res-1", status: reservationStatus, userId: ownerId,
      client: { name: clientName },
      property: { name: "Casa" },
      user: { email: ownerEmail, name: ownerName },
    },
  };
}

async function getHandler() {
  const mod = await import("../route");
  return mod.POST;
}

async function callRoute(auth: string | null) {
  const POST = await getHandler();
  const req = new Request(
    "http://localhost/api/cron/payment-reminders/dispatch",
    { method: "POST", headers: auth ? { authorization: auth } : {} },
  );
  return POST(req);
}

describe("auth", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("retorna 401 sin REMINDERS_CRON_SECRET", async () => {
    vi.stubEnv("REMINDERS_CRON_SECRET", "");
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    const res = await callRoute(null);
    expect(res.status).toBe(401);
  });

  it("retorna 401 con secret incorrecto", async () => {
    vi.stubEnv("REMINDERS_CRON_SECRET", "correct-secret");
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    const res = await callRoute("Bearer wrong-secret");
    expect(res.status).toBe(401);
  });
});

describe("happy path", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("200 con secret correcto y un pago DUE_TODAY -> llama recordDomainEvent con milestone DUE_TODAY", async () => {
    vi.stubEnv("REMINDERS_CRON_SECRET", "correct-secret");
    const now = new Date();
    const { getDateKeyInTz } = await import("@/lib/domain/timezone");
    const todayKey = getDateKeyInTz(now, "America/Santiago");
    const [year, month, day] = todayKey.split("-").map(Number);
    const dueDateSantiago = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
    const paymentRow = buildPaymentRow({ dueDate: dueDateSantiago });
    mockPrisma.payment.findMany.mockResolvedValue([paymentRow]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockRecordDomainEvent.mockResolvedValue(undefined);
    const res = await callRoute("Bearer correct-secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totalReminders).toBe(1);
    expect(mockRecordDomainEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAYMENT_REMINDER",
        paymentId: "pay-1",
        milestone: "DUE_TODAY",
        ownerId: "user-1",
        ownerEmail: "owner@test.com",
        ownerName: "Carlos",
        clientName: "Juan",
        amount: "150000",
      }),
    );
  });

  it("200 con secret correcto y pago sin match de milestone -> 0 recordatorios", async () => {
    vi.stubEnv("REMINDERS_CRON_SECRET", "correct-secret");
    const farFuture = new Date(Date.now() + 86400000 * 30);
    const paymentRow = buildPaymentRow({ dueDate: farFuture });
    mockPrisma.payment.findMany.mockResolvedValue([paymentRow]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockRecordDomainEvent.mockResolvedValue(undefined);
    const res = await callRoute("Bearer correct-secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totalReminders).toBe(0);
    expect(mockRecordDomainEvent).not.toHaveBeenCalled();
  });
});

describe("idempotencia", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("segunda corrida con keys ya enviadas -> 0 nuevos recordatorios", async () => {
    vi.stubEnv("REMINDERS_CRON_SECRET", "correct-secret");
    const now = new Date();
    const { getDateKeyInTz } = await import("@/lib/domain/timezone");
    const todayKey = getDateKeyInTz(now, "America/Santiago");
    const [year, month, day] = todayKey.split("-").map(Number);
    const dueDateSantiago = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
    const paymentRow = buildPaymentRow({ dueDate: dueDateSantiago });
    mockPrisma.payment.findMany.mockResolvedValue([paymentRow]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockRecordDomainEvent.mockResolvedValue(undefined);
    const res1 = await callRoute("Bearer correct-secret");
    expect((await res1.json()).totalReminders).toBe(1);
    mockPrisma.payment.findMany.mockResolvedValue([paymentRow]);
    mockPrisma.notification.findMany.mockResolvedValue([
      { notificationKey: "payment-reminder:pay-1:DUE_TODAY" },
    ]);
    mockRecordDomainEvent.mockClear();
    const res2 = await callRoute("Bearer correct-secret");
    expect((await res2.json()).totalReminders).toBe(0);
    expect(mockRecordDomainEvent).not.toHaveBeenCalled();
  });
});

describe("aislamiento de fallo por owner", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("si dispatch de un owner falla, el resto continua y el error se reporta", async () => {
    vi.stubEnv("REMINDERS_CRON_SECRET", "correct-secret");
    const now = new Date();
    const { getDateKeyInTz } = await import("@/lib/domain/timezone");
    const todayKey = getDateKeyInTz(now, "America/Santiago");
    const [year, month, day] = todayKey.split("-").map(Number);
    const dueDateSantiago = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
    const pay1 = buildPaymentRow({ id: "pay-1", dueDate: dueDateSantiago, ownerId: "user-1" });
    const pay2 = buildPaymentRow({ id: "pay-2", dueDate: dueDateSantiago, ownerId: "user-2" });
    mockPrisma.payment.findMany.mockResolvedValue([pay1, pay2]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockRecordDomainEvent
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Email provider down"));
    const res = await callRoute("Bearer correct-secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totalReminders).toBe(1);
    expect(body.errors).toContainEqual(expect.stringContaining("user-2"));
  });
});

function sclDateTime(year: number, month: number, day: number, hour = 12) {
  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  const hourStr = String(hour).padStart(2, "0");
  return new Date(year + "-" + monthStr + "-" + dayStr + "T" + hourStr + ":00:00.000Z");
}

describe("timezone", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("un pago con dueDate hoy en America/Santiago produce DUE_TODAY aunque en UTC sea ayer", () => {
    const now = sclDateTime(2026, 5, 20);
    const dueDate = new Date("2026-05-20T12:00:00.000Z");
    const payments = [{
      id: "pay-tz",
      status: "PENDING",
      paymentType: "RESERVATION",
      dueDate,
      reservation: {
        id: "res-tz",
        status: "CONFIRMED",
        client: { name: "TestClient" },
        property: { name: "Prop" },
      },
    }];
    const candidates = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());
    expect(candidates).toHaveLength(1);
    expect(candidates[0].milestone).toBe("DUE_TODAY");
    expect(candidates[0].notificationKey).toBe("payment-reminder:pay-tz:DUE_TODAY");
  });

  it("un pago con dueDate ayer en Santiago produce OVERDUE_1_DAY", () => {
    const now = sclDateTime(2026, 5, 21);
    const dueDate = new Date("2026-05-20T12:00:00.000Z");
    const payments = [{
      id: "pay-overdue",
      status: "PENDING",
      paymentType: "RESERVATION",
      dueDate,
      reservation: {
        id: "res-ov",
        status: "CONFIRMED",
        client: { name: "TestClient" },
        property: { name: "Prop" },
      },
    }];
    const candidates = selectRemindersForDispatch(payments, now, "America/Santiago", new Set());
    expect(candidates).toHaveLength(1);
    expect(candidates[0].milestone).toBe("OVERDUE_1_DAY");
    expect(candidates[0].notificationKey).toBe("payment-reminder:pay-overdue:OVERDUE_1_DAY");
  });

  it("route passa a recordDomainEvent o dueDate formatado en America/Santiago (no UTC) quando horas diferem de dia (fix getDateKeyInTz)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T15:00:00.000Z"));
    vi.stubEnv("REMINDERS_CRON_SECRET", "correct-secret");

    const dueDate = new Date("2026-05-20T03:00:00.000Z");
    const paymentRow = {
      id: "pay-tz-fix",
      status: "PENDING",
      paymentType: "RESERVATION",
      dueDate,
      amount: "150000",
      reservation: {
        id: "res-tz-fix",
        status: "CONFIRMED",
        userId: "user-tz",
        client: { name: "TestClient" },
        property: { name: "Prop" },
        user: { email: "owner@test.com", name: "Carlos" },
      },
    };

    mockPrisma.payment.findMany.mockResolvedValue([paymentRow]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockRecordDomainEvent.mockResolvedValue(undefined);

    const res = await callRoute("Bearer correct-secret");
    expect(res.status).toBe(200);

    expect(mockRecordDomainEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PAYMENT_REMINDER",
        paymentId: "pay-tz-fix",
        milestone: "OVERDUE_1_DAY",
        dueDate: "2026-05-19",
        ownerId: "user-tz",
        ownerEmail: "owner@test.com",
        ownerName: "Carlos",
        clientName: "TestClient",
        amount: "150000",
      }),
    );

    vi.useRealTimers();
  });
});

