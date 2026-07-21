import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

// ──────────────────────────────────────────────────────────────────────────────
// Mocks — hoisted para estar disponibles antes de los imports del módulo
// ──────────────────────────────────────────────────────────────────────────────

const mockApplySubscriptionEvent = vi.fn();
const mockGetSubscriptionByPreapprovalId = vi.fn();
const mockFetchPreapproval = vi.fn();
const mockPrismaSubscriptionFindFirst = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    subscription: {
      findFirst: mockPrismaSubscriptionFindFirst,
    },
  },
}));

vi.mock("@/lib/subscriptions/lifecycle", () => ({
  applySubscriptionEvent: mockApplySubscriptionEvent,
}));

vi.mock("@/lib/subscriptions/queries", () => ({
  getSubscriptionByPreapprovalId: mockGetSubscriptionByPreapprovalId,
}));

vi.mock("@/lib/payment/pro-gateway", () => ({
  getProGateway: () => ({
    fetchPreapproval: mockFetchPreapproval,
  }),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function computeSignature(
  secret: string,
  dataId: string,
  requestId: string,
  ts: string,
): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", secret).update(manifest, "utf-8").digest("hex");
}

function buildPreapprovalPayload(
  action: string,
  preapprovalId: string,
): string {
  return JSON.stringify({ action, data: { id: preapprovalId } });
}

async function makeRequest(
  url: string,
  body: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const { POST } = await import("../route");
  return POST(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...extraHeaders },
      body,
    }),
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests de firma
// ──────────────────────────────────────────────────────────────────────────────

describe("verifyMpProWebhookSignature", () => {
  it("returns true when secret is missing in development (dev bypass)", async () => {
    delete process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET;
    vi.stubEnv("NODE_ENV", "development");

    const { verifyMpProWebhookSignature } = await import("../route");

    const headers = new Headers();
    const result = verifyMpProWebhookSignature(
      headers,
      "{}",
      "https://example.com/api/webhooks/mercadopago-pro",
    );

    expect(result).toBe(true);
  });

  it("returns false when required headers x-signature or x-request-id are missing", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";

    const { verifyMpProWebhookSignature } = await import("../route");

    const headers = new Headers();
    // missing both headers
    expect(
      verifyMpProWebhookSignature(
        headers,
        '{"action":"preapproval.created","data":{"id":"pre-123"}}',
        "https://example.com/api/webhooks/mercadopago-pro?data.id=pre-123&topic=preapproval",
      ),
    ).toBe(false);

    // only x-signature present
    const headers2 = new Headers();
    headers2.set("x-signature", "ts=123,v1=abc");
    expect(
      verifyMpProWebhookSignature(
        headers2,
        '{"action":"preapproval.created","data":{"id":"pre-123"}}',
        "https://example.com/api/webhooks/mercadopago-pro?data.id=pre-123&topic=preapproval",
      ),
    ).toBe(false);
  });

  it("returns false when x-signature format is invalid (missing ts or v1)", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";

    const { verifyMpProWebhookSignature } = await import("../route");

    const headers = new Headers();
    headers.set("x-request-id", "req-abc");
    headers.set("x-signature", "only-v1-no-ts=abc123"); // no ts=

    expect(
      verifyMpProWebhookSignature(
        headers,
        '{"action":"preapproval.created","data":{"id":"pre-123"}}',
        "https://example.com/api/webhooks/mercadopago-pro?data.id=pre-123&topic=preapproval",
      ),
    ).toBe(false);
  });

  it("returns false when signature does not match (tampered data)", async () => {
    const secret = "pro-secret";
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = secret;

    const { verifyMpProWebhookSignature } = await import("../route");

    const ts = "1717094400";
    const requestId = "req-abc";
    // signature computed for pre-123 but we send pre-999 as dataId
    const wrongSig = computeSignature(secret, "pre-999", requestId, ts);

    const headers = new Headers();
    headers.set("x-request-id", requestId);
    headers.set("x-signature", `ts=${ts},v1=${wrongSig}`);

    expect(
      verifyMpProWebhookSignature(
        headers,
        '{"action":"preapproval.created","data":{"id":"pre-123"}}',
        "https://example.com/api/webhooks/mercadopago-pro?data.id=pre-123&topic=preapproval",
      ),
    ).toBe(false);
  });

  it("returns true for valid signature with query data.id", async () => {
    const secret = "pro-secret";
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = secret;

    const { verifyMpProWebhookSignature } = await import("../route");

    const ts = "1717094400";
    const requestId = "req-abc";
    const preapprovalId = "pre-123";
    const validSig = computeSignature(secret, preapprovalId, requestId, ts);

    const headers = new Headers();
    headers.set("x-request-id", requestId);
    headers.set("x-signature", `ts=${ts},v1=${validSig}`);

    const result = verifyMpProWebhookSignature(
      headers,
      '{"action":"preapproval.created","data":{"id":"pre-123"}}',
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
    );

    expect(result).toBe(true);
  });

  it("uses data.id from query params over body payload for signature", async () => {
    const secret = "pro-secret";
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = secret;

    const { verifyMpProWebhookSignature } = await import("../route");

    const ts = "1717094400";
    const requestId = "req-abc";
    // Signature uses query data.id = pre-999
    const validSig = computeSignature(secret, "pre-999", requestId, ts);

    const headers = new Headers();
    headers.set("x-request-id", requestId);
    headers.set("x-signature", `ts=${ts},v1=${validSig}`);

    // Body has pre-123 but query has pre-999 — should use pre-999
    const result = verifyMpProWebhookSignature(
      headers,
      '{"action":"preapproval.created","data":{"id":"pre-123"}}',
      "https://example.com/api/webhooks/mercadopago-pro?data.id=pre-999&topic=preapproval",
    );

    expect(result).toBe(true);
  });

  it("returns false when data.id is missing from both query and body", async () => {
    const secret = "pro-secret";
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = secret;

    const { verifyMpProWebhookSignature } = await import("../route");

    const ts = "1717094400";
    const requestId = "req-abc";
    const validSig = computeSignature(secret, "", requestId, ts);

    const headers = new Headers();
    headers.set("x-request-id", requestId);
    headers.set("x-signature", `ts=${ts},v1=${validSig}`);

    // Body without data.id
    const result = verifyMpProWebhookSignature(
      headers,
      '{"action":"preapproval.created"}',
      "https://example.com/api/webhooks/mercadopago-pro?topic=preapproval",
    );

    expect(result).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests del POST handler
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/mercadopago-pro", () => {
  beforeEach(() => {
    mockApplySubscriptionEvent.mockResolvedValue({ subscription: {} });
  });

  it("returns 401 when x-signature header is missing", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";

    const response = await makeRequest(
      "https://example.com/api/webhooks/mercadopago-pro?data.id=pre-123&topic=preapproval",
      '{"action":"preapproval.created","data":{"id":"pre-123"}}',
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("returns 401 when signature is invalid", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";

    const response = await makeRequest(
      "https://example.com/api/webhooks/mercadopago-pro?data.id=pre-123&topic=preapproval",
      '{"action":"preapproval.created","data":{"id":"pre-123"}}',
      {
        "x-request-id": "req-abc",
        "x-signature": "ts=1717094400,v1=invalid-signature",
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 200 (with warning) when MERCADOPAGO_PRO_WEBHOOK_SECRET is not set in development", async () => {
    delete process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET;
    vi.stubEnv("NODE_ENV", "development");

    const response = await makeRequest(
      "https://example.com/api/webhooks/mercadopago-pro?data.id=pre-123&topic=preapproval",
      '{"action":"preapproval.created","data":{"id":"pre-123"}}',
      { "x-request-id": "req-abc", "x-signature": "ts=1,v1=any" },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      warning: "Subscription not found",
    });
  });

  it("preapproval authorized: calls applySubscriptionEvent with type=authorized", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const preapprovalId = "pre-123";
    const ts = "1717094400";
    const requestId = "req-abc";
    const sig = computeSignature(secret, preapprovalId, requestId, ts);

    mockGetSubscriptionByPreapprovalId.mockResolvedValue({
      id: "sub-1",
      status: "PENDING",
      mpPreapprovalId: preapprovalId,
    });
    mockFetchPreapproval.mockResolvedValue({
      status: "authorized",
      startDate: "2026-07-01T00:00:00Z",
      endDate: "2026-08-01T00:00:00Z",
      nextPaymentDate: "2026-08-01T00:00:00Z",
    });

    const response = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
      buildPreapprovalPayload("preapproval.created", preapprovalId),
      { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${sig}` },
    );

    expect(response.status).toBe(200);
    expect(mockGetSubscriptionByPreapprovalId).toHaveBeenCalledWith(preapprovalId);
    expect(mockFetchPreapproval).toHaveBeenCalledWith(preapprovalId);
    expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
      type: "authorized",
      subscriptionId: "sub-1",
      payload: {
        source: "webhook",
        mpStatus: "authorized",
        startDate: "2026-07-01T00:00:00Z",
        endDate: "2026-08-01T00:00:00Z",
        nextPaymentDate: "2026-08-01T00:00:00Z",
      },
    });
  });

  it("preapproval cancelled: calls applySubscriptionEvent with type=cancelled", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const preapprovalId = "pre-456";
    const ts = "1717094400";
    const requestId = "req-abc";
    const sig = computeSignature(secret, preapprovalId, requestId, ts);

    mockGetSubscriptionByPreapprovalId.mockResolvedValue({
      id: "sub-2",
      status: "AUTHORIZED",
      mpPreapprovalId: preapprovalId,
    });
    mockFetchPreapproval.mockResolvedValue({
      status: "cancelled",
    });

    const response = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
      buildPreapprovalPayload("preapproval.cancelled", preapprovalId),
      { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${sig}` },
    );

    expect(response.status).toBe(200);
    expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
      type: "cancelled",
      subscriptionId: "sub-2",
      payload: {
        source: "webhook",
        mpStatus: "cancelled",
        startDate: undefined,
        endDate: undefined,
        nextPaymentDate: undefined,
      },
    });
  });

  it("preapproval paused: calls applySubscriptionEvent with type=paused", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const preapprovalId = "pre-789";
    const ts = "1717094400";
    const requestId = "req-abc";
    const sig = computeSignature(secret, preapprovalId, requestId, ts);

    mockGetSubscriptionByPreapprovalId.mockResolvedValue({
      id: "sub-3",
      status: "AUTHORIZED",
      mpPreapprovalId: preapprovalId,
    });
    mockFetchPreapproval.mockResolvedValue({ status: "paused" });

    const response = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
      buildPreapprovalPayload("preapproval.paused", preapprovalId),
      { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${sig}` },
    );

    expect(response.status).toBe(200);
    expect(mockApplySubscriptionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "paused", subscriptionId: "sub-3" }),
    );
  });

  it("preapproval pending: returns 200 with warning, does not call applySubscriptionEvent", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const preapprovalId = "pre-pending";
    const ts = "1717094400";
    const requestId = "req-abc";
    const sig = computeSignature(secret, preapprovalId, requestId, ts);

    mockGetSubscriptionByPreapprovalId.mockResolvedValue({
      id: "sub-4",
      status: "PENDING",
      mpPreapprovalId: preapprovalId,
    });
    mockFetchPreapproval.mockResolvedValue({ status: "pending" });

    const response = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
      buildPreapprovalPayload("preapproval.pending", preapprovalId),
      { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${sig}` },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      warning: "Unhandled status: pending",
    });
    expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("preapproval with subscription not found: returns 200 with warning", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const preapprovalId = "pre-unknown";
    const ts = "1717094400";
    const requestId = "req-abc";
    const sig = computeSignature(secret, preapprovalId, requestId, ts);

    mockGetSubscriptionByPreapprovalId.mockResolvedValue(null);

    const response = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
      buildPreapprovalPayload("preapproval.created", preapprovalId),
      { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${sig}` },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      warning: "Subscription not found",
    });
    expect(mockFetchPreapproval).not.toHaveBeenCalled();
    expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("idempotencia: two identical authorized webhooks both call applySubscriptionEvent (idempotency handled inside lifecycle)", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const preapprovalId = "pre-idempotent";
    const ts = "1717094400";
    const requestId = "req-abc";
    const sig = computeSignature(secret, preapprovalId, requestId, ts);

    mockGetSubscriptionByPreapprovalId.mockResolvedValue({
      id: "sub-5",
      status: "PENDING",
      mpPreapprovalId: preapprovalId,
    });
    mockFetchPreapproval.mockResolvedValue({
      status: "authorized",
    });

    const body = buildPreapprovalPayload("preapproval.created", preapprovalId);
    const headers = {
      "x-request-id": requestId,
      "x-signature": `ts=${ts},v1=${sig}`,
    };

    const res1 = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
      body,
      headers,
    );
    const res2 = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
      body,
      headers,
    );

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // applySubscriptionEvent se llama dos veces — la idempotencia A vive dentro del lifecycle
    expect(mockApplySubscriptionEvent).toHaveBeenCalledTimes(2);
    expect(mockApplySubscriptionEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "authorized", subscriptionId: "sub-5" }),
    );
    expect(mockApplySubscriptionEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "authorized", subscriptionId: "sub-5" }),
    );
  });

  it("authorized_payment topic: applies renewed event on first AUTHORIZED subscription", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const paymentId = "mp-payment-999";
    const ts = "1717094400";
    const requestId = "req-abc";
    const sig = computeSignature(secret, paymentId, requestId, ts);

    mockPrismaSubscriptionFindFirst.mockResolvedValue({
      id: "sub-6",
      status: "AUTHORIZED",
    });
    mockApplySubscriptionEvent.mockResolvedValue({ subscription: {} });

    const response = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${paymentId}&topic=authorized_payment`,
      JSON.stringify({ action: "authorized_payment.created", data: { id: paymentId } }),
      { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${sig}` },
    );

    expect(response.status).toBe(200);
    expect(mockPrismaSubscriptionFindFirst).toHaveBeenCalledWith({
      where: { status: "AUTHORIZED" },
    });
    expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
      type: "renewed",
      subscriptionId: "sub-6",
      payload: { source: "webhook", mpPaymentId: paymentId },
    });
  });

  it("authorized_payment with no AUTHORIZED subscription: returns 200 with warning", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const paymentId = "mp-payment-noauth";
    const ts = "1717094400";
    const requestId = "req-abc";
    const sig = computeSignature(secret, paymentId, requestId, ts);

    mockPrismaSubscriptionFindFirst.mockResolvedValue(null);

    const response = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${paymentId}&topic=authorized_payment`,
      JSON.stringify({ action: "authorized_payment.created", data: { id: paymentId } }),
      { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${sig}` },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      warning: "No authorized subscription",
    });
    expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("unknown topic: returns 200 received without processing", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const resourceId = "some-unknown-topic-id";
    const ts = "1717094400";
    const requestId = "req-abc";
    const sig = computeSignature(secret, resourceId, requestId, ts);

    const response = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${resourceId}&topic=unknown_topic`,
      JSON.stringify({ action: "unknown_topic.something", data: { id: resourceId } }),
      { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${sig}` },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("invalid payload (missing action or data.id): returns 400", async () => {
    // Use dev bypass for signature — this test focuses on payload validation
    delete process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET;
    vi.stubEnv("NODE_ENV", "development");

    const response = await makeRequest(
      "https://example.com/api/webhooks/mercadopago-pro",
      '{"no-action-field":true}', // body has no action field — should be rejected
      { "x-request-id": "req-abc", "x-signature": "ts=1,v1=any" },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid payload" });
  });

  it("returns 500 on unexpected error in handler", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const preapprovalId = "pre-error";
    const ts = "1717094400";
    const requestId = "req-abc";
    const sig = computeSignature(secret, preapprovalId, requestId, ts);

    // Simular error en fetchPreapproval
    mockGetSubscriptionByPreapprovalId.mockResolvedValue({
      id: "sub-err",
      status: "AUTHORIZED",
      mpPreapprovalId: preapprovalId,
    });
    mockFetchPreapproval.mockRejectedValue(new Error("MP API is down"));

    const response = await makeRequest(
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
      buildPreapprovalPayload("preapproval.cancelled", preapprovalId),
      { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${sig}` },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Webhook processing error",
    });
  });
});
