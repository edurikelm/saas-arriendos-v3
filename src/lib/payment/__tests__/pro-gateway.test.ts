import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MercadoPagoProGateway,
  getProGateway,
  clearProGatewayCache,
} from "../pro-gateway";

// Mockear fetch global antes de cada test
const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.MERCADOPAGO_PRO_ACCESS_TOKEN;
  delete process.env.MERCADOPAGO_PRO_PLAN_ID;
}

beforeEach(() => {
  resetEnv();
  mockFetch.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
  clearProGatewayCache();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

// =============================================================================
// ensurePlan()
// =============================================================================

describe("ensurePlan()", () => {
  it("retorna env var MERCADOPAGO_PRO_PLAN_ID si está seteada, sin llamar a fetch", async () => {
    process.env.MERCADOPAGO_PRO_PLAN_ID = "plan-env-123";
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";

    const gateway = new MercadoPagoProGateway();
    const result = await gateway.ensurePlan();

    expect(result).toEqual({ planId: "plan-env-123" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("crea plan en MP si MERCADOPAGO_PRO_PLAN_ID no está seteada", async () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "plan-mp-456" }),
    });

    const gateway = new MercadoPagoProGateway();
    const result = await gateway.ensurePlan();

    expect(result).toEqual({ planId: "plan-mp-456" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/preapproval_plan",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-test",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("ensurePlan() — body del plan tiene los campos correctos", async () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "plan-mp-789" }),
    });

    const gateway = new MercadoPagoProGateway();
    await gateway.ensurePlan();

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body).toMatchObject({
      reason: "RentalPro PRO - Suscripcion mensual",
      back_url: "https://app.example.com/settings/billing?subscription=created",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        currency_id: "CLP",
        transaction_amount: 9990,
      },
    });
  });

  it("lanza error si MERCADOPAGO_PRO_ACCESS_TOKEN no está configurada", async () => {
    // No se setea MERCADOPAGO_PRO_ACCESS_TOKEN
    const gateway = new MercadoPagoProGateway();
    await expect(gateway.ensurePlan()).rejects.toThrow(
      "MERCADOPAGO_PRO_ACCESS_TOKEN is not configured",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("lanza error si MP responde con status >= 400 al crear plan", async () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ message: "Plan creation failed" }),
    });

    const gateway = new MercadoPagoProGateway();
    await expect(gateway.ensurePlan()).rejects.toThrow(
      "Mercado Pago preapproval_plan error: Plan creation failed",
    );
  });
});

// =============================================================================
// createPreapproval()
// =============================================================================

describe("createPreapproval()", () => {
  const setupToken = () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  };

  it("arma body correcto con preapproval_plan_id, payer_email, back_url, external_reference y status", async () => {
    setupToken();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "preapproval-123", init_point: "https://mp.com/init" }),
    });

    const gateway = new MercadoPagoProGateway();
    const beforeCall = Date.now();
    await gateway.createPreapproval({
      userId: "user-abc",
      payerEmail: "owner@example.com",
      planId: "plan-xyz",
    });

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body as string);

    expect(body).toMatchObject({
      preapproval_plan_id: "plan-xyz",
      payer_email: "owner@example.com",
      back_url: "https://app.example.com/settings/billing?subscription=authorized",
      status: "authorized",
    });
    // external_reference = "userId:timestamp", timestamp entre beforeCall y después del call
    expect(body.external_reference).toMatch(/^user-abc:\d+$/);
    const timestamp = parseInt(body.external_reference.split(":")[1], 10);
    expect(timestamp).toBeGreaterThanOrEqual(beforeCall);
  });

  it("retorna preapprovalId y initPoint desde la respuesta de MP", async () => {
    setupToken();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "preapproval-mp-999",
        init_point: "https://mercadopago.com/checkout?pref=abc",
      }),
    });

    const gateway = new MercadoPagoProGateway();
    const result = await gateway.createPreapproval({
      userId: "user-1",
      payerEmail: "owner@test.com",
      planId: "plan-1",
    });

    expect(result).toEqual({
      preapprovalId: "preapproval-mp-999",
      initPoint: "https://mercadopago.com/checkout?pref=abc",
    });
  });

  it("lanza error claro si MP devuelve 400", async () => {
    setupToken();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ message: "Invalid payer email" }),
    });

    const gateway = new MercadoPagoProGateway();
    await expect(
      gateway.createPreapproval({
        userId: "user-1",
        payerEmail: "bad-email",
        planId: "plan-1",
      }),
    ).rejects.toThrow("Mercado Pago preapproval error: Invalid payer email");
  });

  it("incluye Authorization Bearer header en createPreapproval", async () => {
    setupToken();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "preapproval-1", init_point: "https://mp.com/init" }),
    });

    const gateway = new MercadoPagoProGateway();
    await gateway.createPreapproval({
      userId: "user-1",
      payerEmail: "owner@test.com",
      planId: "plan-1",
    });

    expect(mockFetch.mock.calls[0][1].headers).toMatchObject({
      Authorization: "Bearer token-test",
      "Content-Type": "application/json",
    });
  });

  it("lanza error si MERCADOPAGO_PRO_ACCESS_TOKEN no está al crear preapproval", async () => {
    // No se setea token
    const gateway = new MercadoPagoProGateway();
    await expect(
      gateway.createPreapproval({
        userId: "user-1",
        payerEmail: "owner@test.com",
        planId: "plan-1",
      }),
    ).rejects.toThrow("MERCADOPAGO_PRO_ACCESS_TOKEN is not configured");
  });
});

// =============================================================================
// cancelPreapproval()
// =============================================================================

describe("cancelPreapproval()", () => {
  it("hace PUT a /v1/preapproval/{id} con status cancelled", async () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const gateway = new MercadoPagoProGateway();
    await gateway.cancelPreapproval("preapproval-abc");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/preapproval/preapproval-abc",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer token-test",
        }),
        body: JSON.stringify({ status: "cancelled" }),
      }),
    );
  });

  it("lanza error si MP responde con error al cancelar", async () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ message: "Preapproval not found" }),
    });

    const gateway = new MercadoPagoProGateway();
    await expect(gateway.cancelPreapproval("preapproval-missing")).rejects.toThrow(
      "Mercado Pago cancel preapproval error: Preapproval not found",
    );
  });

  it("lanza error si MERCADOPAGO_PRO_ACCESS_TOKEN no está al cancelar", async () => {
    const gateway = new MercadoPagoProGateway();
    await expect(gateway.cancelPreapproval("preapproval-1")).rejects.toThrow(
      "MERCADOPAGO_PRO_ACCESS_TOKEN is not configured",
    );
  });
});

// =============================================================================
// fetchPreapproval()
// =============================================================================

describe("fetchPreapproval()", () => {
  it("retorna MpPreapprovalInfo con campos parseados correctamente", async () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "preapproval-fetch-1",
        status: "authorized",
        init_point: "https://mp.com/init",
        next_payment_date: "2026-08-21T10:00:00.000-04:00",
        start_date: "2026-07-21T10:00:00.000-04:00",
        end_date: "2026-08-21T10:00:00.000-04:00",
        payer_email: "owner@test.com",
        preapproval_plan_id: "plan-1",
      }),
    });

    const gateway = new MercadoPagoProGateway();
    const result = await gateway.fetchPreapproval("preapproval-fetch-1");

    expect(result).toEqual({
      id: "preapproval-fetch-1",
      status: "authorized",
      initPoint: "https://mp.com/init",
      nextPaymentDate: "2026-08-21T10:00:00.000-04:00",
      startDate: "2026-07-21T10:00:00.000-04:00",
      endDate: "2026-08-21T10:00:00.000-04:00",
      payerEmail: "owner@test.com",
      preapprovalPlanId: "plan-1",
    });
  });

  it("retorna campos opcionales como undefined si MP no los devuelve", async () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "preapproval-simple",
        status: "pending",
      }),
    });

    const gateway = new MercadoPagoProGateway();
    const result = await gateway.fetchPreapproval("preapproval-simple");

    expect(result).toEqual({
      id: "preapproval-simple",
      status: "pending",
      initPoint: undefined,
      nextPaymentDate: undefined,
      startDate: undefined,
      endDate: undefined,
      payerEmail: undefined,
      preapprovalPlanId: undefined,
    });
  });

  it("lanza error si MP responde 404 al hacer fetch", async () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({}),
    });

    const gateway = new MercadoPagoProGateway();
    await expect(gateway.fetchPreapproval("preapproval-missing")).rejects.toThrow(
      "Mercado Pago fetch preapproval error: Not Found",
    );
  });

  it("lanza error si MERCADOPAGO_PRO_ACCESS_TOKEN no está al hacer fetch", async () => {
    const gateway = new MercadoPagoProGateway();
    await expect(gateway.fetchPreapproval("preapproval-1")).rejects.toThrow(
      "MERCADOPAGO_PRO_ACCESS_TOKEN is not configured",
    );
  });
});

// =============================================================================
// createPreapproval() - X-Idempotency-Key
// =============================================================================

describe("createPreapproval - X-Idempotency-Key", () => {
  const setupToken = () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  };

  beforeEach(() => {
    setupToken();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "pre-1", init_point: "https://..." }),
    });
  });

  it("includes X-Idempotency-Key header in createPreapproval request", async () => {
    const gateway = new MercadoPagoProGateway();
    await gateway.createPreapproval({
      userId: "user-1",
      payerEmail: "test@example.com",
      planId: "plan-1",
    });

    expect(mockFetch).toHaveBeenCalled();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-Idempotency-Key"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("generates a new UUID for each createPreapproval call", async () => {
    const gateway = new MercadoPagoProGateway();
    await gateway.createPreapproval({
      userId: "user-1",
      payerEmail: "test@example.com",
      planId: "plan-1",
    });
    await gateway.createPreapproval({
      userId: "user-1",
      payerEmail: "test@example.com",
      planId: "plan-1",
    });

    const [, options1] = mockFetch.mock.calls[0];
    const [, options2] = mockFetch.mock.calls[1];
    expect(options1.headers["X-Idempotency-Key"]).not.toBe(
      options2.headers["X-Idempotency-Key"],
    );
  });
});

// =============================================================================
// getProGateway() singleton
// =============================================================================

describe("getProGateway()", () => {
  it("retorna la misma instancia en llamadas sucesivas", () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    const instance1 = getProGateway();
    const instance2 = getProGateway();
    expect(instance1).toBe(instance2);
  });

  it("retorna nueva instancia después de clearProGatewayCache()", () => {
    process.env.MERCADOPAGO_PRO_ACCESS_TOKEN = "token-test";
    const instance1 = getProGateway();
    clearProGatewayCache();
    const instance2 = getProGateway();
    expect(instance1).not.toBe(instance2);
  });
});
