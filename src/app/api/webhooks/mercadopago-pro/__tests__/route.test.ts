import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { addMonths } from "date-fns";

import { buildManifest, computeSignature } from "../../__tests__/helpers";
import { PRO_PRICING } from "@/lib/subscriptions/pricing";

// ──────────────────────────────────────────────────────────────────────────────
// Mocks — hoisted para estar disponibles antes de los imports del módulo
// ──────────────────────────────────────────────────────────────────────────────

const mockApplySubscriptionEvent = vi.fn();
const mockGetSubscriptionByPreapprovalId = vi.fn();
const mockFetchPreapproval = vi.fn();
const mockFetchAuthorizedPayment = vi.fn();
const mockHasSubscriptionEventForAuthorizedPayment = vi.fn();

vi.mock("@/lib/subscriptions/lifecycle", () => ({
  applySubscriptionEvent: mockApplySubscriptionEvent,
}));

vi.mock("@/lib/subscriptions/queries", () => ({
  getSubscriptionByPreapprovalId: mockGetSubscriptionByPreapprovalId,
  hasSubscriptionEventForAuthorizedPayment: mockHasSubscriptionEventForAuthorizedPayment,
}));

vi.mock("@/lib/payment/pro-gateway", () => ({
  getProGateway: () => ({
    fetchPreapproval: mockFetchPreapproval,
    fetchAuthorizedPayment: mockFetchAuthorizedPayment,
  }),
}));

// ─── timingSafeEqual spy via vi.hoisted ───────────────────────────────────────
const timingSafeEqualMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const actual = require('crypto') as typeof import('crypto');
  return {
    default: actual,
    ...actual,
    timingSafeEqual: timingSafeEqualMock,
  };
});

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
    const wrongSig = computeSignature(secret, buildManifest("pre-999", requestId, ts));

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

    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const preapprovalId = "pre-123";
    const validSig = computeSignature(secret, buildManifest(preapprovalId, requestId, ts));

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

    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    // Signature uses query data.id = pre-999
    const validSig = computeSignature(secret, buildManifest("pre-999", requestId, ts));

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

    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const validSig = computeSignature(secret, buildManifest("", requestId, ts));

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

  // ──────────────────────────────────────────────────────────────────────────────
  // RED test for issue #199 — timing-safe HMAC comparison
  // ──────────────────────────────────────────────────────────────────────────────

  it("uses crypto.timingSafeEqual for HMAC comparison", async () => {
    const secret = "pro-secret";
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = secret;

    const { verifyMpProWebhookSignature } = await import("../route");

    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const preapprovalId = "pre-123";
    const validSig = computeSignature(secret, buildManifest(preapprovalId, requestId, ts));

    const headers = new Headers();
    headers.set("x-request-id", requestId);
    headers.set("x-signature", `ts=${ts},v1=${validSig}`);

    verifyMpProWebhookSignature(
      headers,
      '{"action":"preapproval.created","data":{"id":"pre-123"}}',
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
    );

    expect(timingSafeEqualMock).toHaveBeenCalled();
    expect(timingSafeEqualMock.mock.calls[0].length).toBe(2);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // RED test for issue #198 — timestamp tolerance / replay protection
  // ──────────────────────────────────────────────────────────────────────────────

  it("rejects signature with ts more than 5 minutes in the past (replay protection)", async () => {
    const secret = "pro-secret";
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = secret;

    const { verifyMpProWebhookSignature } = await import("../route");

    const now = Date.now();
    const ts = String(Math.floor(now / 1000) - 6 * 60); // 6 minutes in the past
    const requestId = "req-abc";
    const preapprovalId = "pre-123";
    const validSig = computeSignature(secret, buildManifest(preapprovalId, requestId, ts));

    const headers = new Headers();
    headers.set("x-request-id", requestId);
    headers.set("x-signature", `ts=${ts},v1=${validSig}`);

    const result = verifyMpProWebhookSignature(
      headers,
      '{"action":"preapproval.created","data":{"id":"pre-123"}}',
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${preapprovalId}&topic=preapproval`,
    );

    expect(result).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // RED test for issue #197 — uppercase alphanumeric data.id HMAC bug
  // ──────────────────────────────────────────────────────────────────────────────

  it("accepts valid signature with uppercase alphanumeric dataId when HMAC uses lowercase", async () => {
    const secret = "pro-secret";
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = secret;

    const { verifyMpProWebhookSignature } = await import("../route");

    const dataId = "ORDTST01ABCDEF1234567890";
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";

    // MP computes the manifest signature using the lowercase version of dataId
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const validSignature = createHmac("sha256", secret)
      .update(manifest, "utf-8")
      .digest("hex");

    const headers = new Headers();
    headers.set("x-request-id", requestId);
    headers.set("x-signature", `ts=${ts},v1=${validSignature}`);

    // MP sends the dataId in UPPERCASE in the query param
    const result = verifyMpProWebhookSignature(
      headers,
      '{"action":"preapproval.created","data":{"id":"pre-123"}}',
      `https://example.com/api/webhooks/mercadopago-pro?data.id=${dataId}&topic=preapproval`,
    );

    expect(result).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests del POST handler
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/mercadopago-pro", () => {
  beforeEach(() => {
    mockApplySubscriptionEvent.mockResolvedValue({ subscription: {} });
    mockHasSubscriptionEventForAuthorizedPayment.mockResolvedValue(false);
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
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const sig = computeSignature(secret, buildManifest(preapprovalId, requestId, ts));

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
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const sig = computeSignature(secret, buildManifest(preapprovalId, requestId, ts));

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
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const sig = computeSignature(secret, buildManifest(preapprovalId, requestId, ts));

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
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const sig = computeSignature(secret, buildManifest(preapprovalId, requestId, ts));

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
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const sig = computeSignature(secret, buildManifest(preapprovalId, requestId, ts));

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
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const sig = computeSignature(secret, buildManifest(preapprovalId, requestId, ts));

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

  describe("authorized_payment topic", () => {
    // El guard de next_payment_date compara contra Date.now(): sin reloj fijo,
    // las fechas de los fixtures dejarían de ser "futuras" con el tiempo.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-09-21T15:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function makeAuthorizedPaymentRequest(authorizedPaymentId: string) {
      process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
      const secret = "pro-secret";
      const ts = String(Math.floor(Date.now() / 1000));
      const requestId = "req-abc";
      const sig = computeSignature(secret, buildManifest(authorizedPaymentId, requestId, ts));

      return makeRequest(
        `https://example.com/api/webhooks/mercadopago-pro?data.id=${authorizedPaymentId}&topic=authorized_payment`,
        JSON.stringify({
          action: "authorized_payment.created",
          data: { id: authorizedPaymentId },
        }),
        { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${sig}` },
      );
    }

    it("approved: looks up the subscription by the payment's preapprovalId and renews THAT one (#190 regression)", async () => {
      const authorizedPaymentId = "ap-999";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-owner-b",
        paymentId: "payment-b-1",
        paymentStatus: "approved",
        debitDate: "2026-09-21T10:00:00.000-04:00",
      });

      // Dos suscripciones distintas conviven — el bug renovaba la primera
      // que encontraba (owner A) sin importar cuál preapproval fue cobrado.
      mockGetSubscriptionByPreapprovalId.mockImplementation((preapprovalId: string) => {
        if (preapprovalId === "preapproval-owner-a") {
          return Promise.resolve({ id: "sub-owner-a", status: "AUTHORIZED" });
        }
        if (preapprovalId === "preapproval-owner-b") {
          return Promise.resolve({ id: "sub-owner-b", status: "AUTHORIZED" });
        }
        return Promise.resolve(null);
      });
      mockFetchPreapproval.mockResolvedValue({
        nextPaymentDate: "2026-10-21T10:00:00.000-04:00",
      });

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        subscriptionId: "sub-owner-b",
      });
      expect(mockGetSubscriptionByPreapprovalId).toHaveBeenCalledWith(
        "preapproval-owner-b",
      );
      expect(mockFetchPreapproval).toHaveBeenCalledWith("preapproval-owner-b");
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
        type: "renewed",
        subscriptionId: "sub-owner-b", // NOT sub-owner-a
        payload: {
          source: "webhook",
          mpAuthorizedPaymentId: authorizedPaymentId,
          mpPaymentId: "payment-b-1",
          startDate: "2026-09-21T14:00:00.000Z",
          endDate: "2026-10-21T10:00:00.000-04:00",
          nextPaymentDate: "2026-10-21T10:00:00.000-04:00",
        },
      });
    });

    it("rejected: applies payment_failed with mpPaymentId and does not fetch the preapproval", async () => {
      const authorizedPaymentId = "ap-rejected-1";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-rejected-1",
        paymentStatus: "rejected",
        paymentStatusDetail: "cc_rejected_insufficient_amount",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        subscriptionId: "sub-1",
      });
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
        type: "payment_failed",
        subscriptionId: "sub-1",
        payload: {
          source: "webhook",
          mpAuthorizedPaymentId: authorizedPaymentId,
          mpPaymentId: "payment-rejected-1",
          statusDetail: "cc_rejected_insufficient_amount",
        },
      });
      expect(mockFetchPreapproval).not.toHaveBeenCalled();
    });

    it("rejected duplicate: returns 200 duplicate:true, lifecycle not called", async () => {
      const authorizedPaymentId = "ap-rejected-dup";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-dup-rejected",
        paymentStatus: "rejected",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });
      mockHasSubscriptionEventForAuthorizedPayment.mockResolvedValue(true);

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        subscriptionId: "sub-1",
        duplicate: true,
      });
      expect(mockHasSubscriptionEventForAuthorizedPayment).toHaveBeenCalledWith(
        "sub-1",
        "payment_failed",
        "mpPaymentId",
        "payment-dup-rejected",
      );
      expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
    });

    it("two rejected deliveries with different paymentIds under the same authorizedPaymentId: lifecycle called for each", async () => {
      const authorizedPaymentId = "ap-rejected-retry";

      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });

      mockFetchAuthorizedPayment.mockResolvedValueOnce({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-attempt-1",
        paymentStatus: "rejected",
      });
      const response1 = await makeAuthorizedPaymentRequest(authorizedPaymentId);
      expect(response1.status).toBe(200);

      mockFetchAuthorizedPayment.mockResolvedValueOnce({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-attempt-2",
        paymentStatus: "rejected",
      });
      const response2 = await makeAuthorizedPaymentRequest(authorizedPaymentId);
      expect(response2.status).toBe(200);

      expect(mockApplySubscriptionEvent).toHaveBeenCalledTimes(2);
      expect(mockApplySubscriptionEvent).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: "payment_failed",
          payload: expect.objectContaining({ mpPaymentId: "payment-attempt-1" }),
        }),
      );
      expect(mockApplySubscriptionEvent).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: "payment_failed",
          payload: expect.objectContaining({ mpPaymentId: "payment-attempt-2" }),
        }),
      );
    });

    it("rejected with paymentId undefined: dedupe helper not called, payment_failed still applied", async () => {
      const authorizedPaymentId = "ap-rejected-no-payment-id";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentStatus: "rejected",
        paymentStatusDetail: "cc_rejected_call_for_authorize",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(mockHasSubscriptionEventForAuthorizedPayment).not.toHaveBeenCalled();
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
        type: "payment_failed",
        subscriptionId: "sub-1",
        payload: {
          source: "webhook",
          mpAuthorizedPaymentId: authorizedPaymentId,
          mpPaymentId: undefined,
          statusDetail: "cc_rejected_call_for_authorize",
        },
      });
    });

    it("duplicate approved: returns 200 duplicate:true and does not call lifecycle", async () => {
      const authorizedPaymentId = "ap-dup-1";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-dup-1",
        paymentStatus: "approved",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });
      mockHasSubscriptionEventForAuthorizedPayment.mockResolvedValue(true);

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        subscriptionId: "sub-1",
        duplicate: true,
      });
      expect(mockHasSubscriptionEventForAuthorizedPayment).toHaveBeenCalledWith(
        "sub-1",
        "renewed",
        "mpAuthorizedPaymentId",
        authorizedPaymentId,
      );
      expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
      expect(mockFetchPreapproval).not.toHaveBeenCalled();
    });

    it("subscription not found for the payment's preapprovalId: returns 200 warning, lifecycle not called", async () => {
      const authorizedPaymentId = "ap-no-sub";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-unknown",
        paymentId: "payment-1",
        paymentStatus: "approved",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue(null);

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        warning: "Subscription not found",
      });
      expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
    });

    it("authorized_payment without preapprovalId: returns 200 warning", async () => {
      const authorizedPaymentId = "ap-no-preapproval";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        paymentStatus: "approved",
      });

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        warning: "Authorized payment without preapproval",
      });
      expect(mockGetSubscriptionByPreapprovalId).not.toHaveBeenCalled();
      expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
    });

    it("approved on a CANCELLED subscription: applies payment_unapplied for audit, returns warning, no renewed call", async () => {
      const authorizedPaymentId = "ap-not-authorized";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "approved",
        debitDate: "2026-09-21T10:00:00.000-04:00",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "CANCELLED",
      });

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        warning: "Subscription not authorized: CANCELLED",
      });
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
        type: "payment_unapplied",
        subscriptionId: "sub-1",
        payload: {
          source: "webhook",
          mpAuthorizedPaymentId: authorizedPaymentId,
          mpPaymentId: "payment-1",
          subscriptionStatus: "CANCELLED",
          debitDate: "2026-09-21T10:00:00.000-04:00",
        },
      });
      expect(mockFetchPreapproval).not.toHaveBeenCalled();
    });

    it("approved on an EXPIRED subscription: applies payment_unapplied for audit too", async () => {
      const authorizedPaymentId = "ap-expired";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "approved",
        debitDate: "2026-09-21T10:00:00.000-04:00",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "EXPIRED",
      });

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        warning: "Subscription not authorized: EXPIRED",
      });
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "payment_unapplied", subscriptionId: "sub-1" }),
      );
    });

    it("dedupe for payment_unapplied: already recorded → lifecycle not called", async () => {
      const authorizedPaymentId = "ap-unapplied-dup";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "approved",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "CANCELLED",
      });
      mockHasSubscriptionEventForAuthorizedPayment.mockResolvedValue(true);

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        warning: "Subscription not authorized: CANCELLED",
      });
      expect(mockHasSubscriptionEventForAuthorizedPayment).toHaveBeenCalledWith(
        "sub-1",
        "payment_unapplied",
        "mpAuthorizedPaymentId",
        authorizedPaymentId,
      );
      expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
    });

    it("approved without debitDate: startDate falls back to dateCreated", async () => {
      const authorizedPaymentId = "ap-no-debitdate";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "approved",
        dateCreated: "2026-09-10T08:00:00.000-04:00",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });
      mockFetchPreapproval.mockResolvedValue({
        nextPaymentDate: "2026-10-10T08:00:00.000-04:00",
      });

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            startDate: "2026-09-10T12:00:00.000Z",
          }),
        }),
      );
    });

    it("approved where fetchPreapproval throws: returns 500, lifecycle not called", async () => {
      const authorizedPaymentId = "ap-preapproval-error";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "approved",
        debitDate: "2026-09-21T10:00:00.000-04:00",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });
      mockFetchPreapproval.mockRejectedValue(new Error("MP API is down"));

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Webhook processing error" });
      expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
    });

    it("stale nextPaymentDate (<= debitDate): endDate falls back to debitDate + 1 month of plan", async () => {
      const authorizedPaymentId = "ap-stale-next-payment";
      const debitDate = "2026-09-21T10:00:00.000-04:00";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "approved",
        debitDate,
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });
      // next_payment_date que MP no alcanzó a avanzar aún — igual al débito
      mockFetchPreapproval.mockResolvedValue({ nextPaymentDate: debitDate });

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      const expectedFallback = addMonths(
        new Date(debitDate),
        PRO_PRICING.monthly.frequency,
      ).toISOString();
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            startDate: new Date(debitDate).toISOString(),
            endDate: expectedFallback,
            nextPaymentDate: expectedFallback,
          }),
        }),
      );
    });

    it("nextPaymentDate still in the future but same day as the debit (not advanced): falls back", async () => {
      const authorizedPaymentId = "ap-same-day-next-payment";
      const debitDate = "2026-09-21T00:00:00.000-04:00";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "approved",
        debitDate,
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });
      // Reloj fijo en 2026-09-21T15:00Z: esta fecha es futura, pero es el
      // mismo día del débito — MP no la avanzó y el cron la expiraría hoy.
      mockFetchPreapproval.mockResolvedValue({
        nextPaymentDate: "2026-09-21T13:00:00.000-04:00",
      });

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      const expectedFallback = addMonths(
        new Date(debitDate),
        PRO_PRICING.monthly.frequency,
      ).toISOString();
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            endDate: expectedFallback,
            nextPaymentDate: expectedFallback,
          }),
        }),
      );
    });

    it("malformed debitDate: does not throw, falls back from now", async () => {
      const authorizedPaymentId = "ap-bad-debit-date";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "approved",
        debitDate: "not-a-date",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });
      mockFetchPreapproval.mockResolvedValue({});

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      const expectedFallback = addMonths(
        new Date("2026-09-21T15:00:00.000Z"),
        PRO_PRICING.monthly.frequency,
      ).toISOString();
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            startDate: "2026-09-21T15:00:00.000Z",
            endDate: expectedFallback,
            nextPaymentDate: expectedFallback,
          }),
        }),
      );
    });

    it("approved on a PENDING subscription (first charge before authorization): payment_unapplied logged as warn, not error", async () => {
      const authorizedPaymentId = "ap-first-charge";
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "approved",
        debitDate: "2026-09-21T10:00:00.000-04:00",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "PENDING",
      });
      mockHasSubscriptionEventForAuthorizedPayment.mockResolvedValue(false);

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "payment_unapplied", subscriptionId: "sub-1" }),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "[MP Pro Webhook] Approved charge on non-authorized subscription",
        expect.objectContaining({ status: "PENDING" }),
      );
      expect(errorSpy).not.toHaveBeenCalledWith(
        "[MP Pro Webhook] Approved charge on non-authorized subscription",
        expect.anything(),
      );

      errorSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("missing nextPaymentDate: same debitDate + 1 month fallback as stale", async () => {
      const authorizedPaymentId = "ap-missing-next-payment";
      const debitDate = "2026-09-21T10:00:00.000-04:00";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "approved",
        debitDate,
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });
      mockFetchPreapproval.mockResolvedValue({}); // sin next_payment_date

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      const expectedFallback = addMonths(
        new Date(debitDate),
        PRO_PRICING.monthly.frequency,
      ).toISOString();
      expect(mockApplySubscriptionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            endDate: expectedFallback,
            nextPaymentDate: expectedFallback,
          }),
        }),
      );
    });

    it("pending payment status: returns 200 warning, no lifecycle call", async () => {
      const authorizedPaymentId = "ap-pending";

      mockFetchAuthorizedPayment.mockResolvedValue({
        id: authorizedPaymentId,
        preapprovalId: "preapproval-1",
        paymentId: "payment-1",
        paymentStatus: "pending",
      });
      mockGetSubscriptionByPreapprovalId.mockResolvedValue({
        id: "sub-1",
        status: "AUTHORIZED",
      });

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        subscriptionId: "sub-1",
        warning: "Unhandled payment status: pending",
      });
      expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
    });

    it("gateway throws when fetching the authorized payment: returns 500", async () => {
      const authorizedPaymentId = "ap-error";

      mockFetchAuthorizedPayment.mockRejectedValue(new Error("MP API is down"));

      const response = await makeAuthorizedPaymentRequest(authorizedPaymentId);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Webhook processing error",
      });
      expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
    });
  });

  it("unknown topic: returns 200 received without processing", async () => {
    process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET = "pro-secret";
    const secret = "pro-secret";
    const resourceId = "some-unknown-topic-id";
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const sig = computeSignature(secret, buildManifest(resourceId, requestId, ts));

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
    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = "req-abc";
    const sig = computeSignature(secret, buildManifest(preapprovalId, requestId, ts));

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
