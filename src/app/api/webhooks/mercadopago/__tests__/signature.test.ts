import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';

const processMercadoPagoWebhookMock = vi.fn();

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

vi.mock('@/lib/actions/payments', () => ({
  processMercadoPagoWebhook: processMercadoPagoWebhookMock,
}));

const getMercadoPagoTokenMock = vi.fn();

vi.mock('@/lib/actions/mercado-pago', () => ({
  getMercadoPagoToken: getMercadoPagoTokenMock,
}));

const prismaMock = {
  payment: {
    findFirst: vi.fn(),
  },
  userIntegration: {
    findMany: vi.fn(),
  },
};

vi.mock('@/lib/db/prisma', () => ({
  prisma: prismaMock,
}));

function computeSignature(secret: string, manifest: string): string {
  return createHmac('sha256', secret).update(manifest, 'utf-8').digest('hex');
}

function buildManifest(dataId: string, requestId: string, ts: string): string {
  return `id:${dataId};request-id:${requestId};ts:${ts};`;
}

describe('verifyMercadoPagoSignature', () => {
  it('returns true when secret is missing in development (dev bypass)', async () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    vi.stubEnv('NODE_ENV', 'development');

    const { verifyMercadoPagoSignature } = await import('../route');

    const headers = new Headers();
    const result = verifyMercadoPagoSignature(headers, '{}', 'https://example.com/api/webhooks/mercadopago');

    expect(result).toBe(true);
  });

  it('returns false when required headers are missing', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'my-secret-key';

    const { verifyMercadoPagoSignature } = await import('../route');

    const headers = new Headers();
    const result = verifyMercadoPagoSignature(
      headers,
      '{"action":"payment.updated","data":{"id":"12345"}}',
      'https://example.com/api/webhooks/mercadopago'
    );

    expect(result).toBe(false);
  });

  it('returns false when signature does not match official manifest', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'my-secret-key';

    const { verifyMercadoPagoSignature } = await import('../route');

    const rawBody = '{"action":"payment.updated","data":{"id":"12345"}}';
    const headers = new Headers();
    headers.set('x-request-id', 'request-abc');
    headers.set('x-signature', 'ts=1717094400,v1=wrong-signature');

    const result = verifyMercadoPagoSignature(
      headers,
      rawBody,
      'https://example.com/api/webhooks/mercadopago?topic=payment&id=12345'
    );

    expect(result).toBe(false);
  });

  it('returns true for valid official Mercado Pago signature format', async () => {
    const secret = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;

    const { verifyMercadoPagoSignature } = await import('../route');

    const ts = '1717094400';
    const requestId = 'request-abc';
    const manifest = buildManifest('12345', requestId, ts);
    const validSignature = computeSignature(secret, manifest);

    const rawBody = '{"action":"payment.updated","data":{"id":"12345"}}';

    const headers = new Headers();
    headers.set('x-request-id', requestId);
    headers.set('x-signature', `ts=${ts},v1=${validSignature}`);
    const result = verifyMercadoPagoSignature(
      headers,
      rawBody,
      'https://example.com/api/webhooks/mercadopago?data.id=12345&type=payment'
    );

    expect(result).toBe(true);
  });

  it('uses data.id from query params when present', async () => {
    const secret = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;

    const { verifyMercadoPagoSignature } = await import('../route');

    const ts = '1717094400';
    const requestId = 'request-abc';
    const manifest = buildManifest('99999', requestId, ts);
    const validSignature = computeSignature(secret, manifest);

    const rawBody = '{"action":"payment.updated","data":{"id":"12345"}}';

    const headers = new Headers();
    headers.set('x-request-id', requestId);
    headers.set('x-signature', `ts=${ts},v1=${validSignature}`);
    const result = verifyMercadoPagoSignature(
      headers,
      rawBody,
      'https://example.com/api/webhooks/mercadopago?data.id=99999&type=payment'
    );

    expect(result).toBe(true);
  });

  it('uses legacy id query param when data.id is absent', async () => {
    const secret = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;

    const { verifyMercadoPagoSignature } = await import('../route');

    const ts = '1717094400';
    const requestId = 'request-abc';
    const manifest = buildManifest('12345', requestId, ts);
    const validSignature = computeSignature(secret, manifest);

    const headers = new Headers();
    headers.set('x-request-id', requestId);
    headers.set('x-signature', `ts=${ts},v1=${validSignature}`);

    const result = verifyMercadoPagoSignature(
      headers,
      '',
      'https://example.com/api/webhooks/mercadopago?id=12345&topic=payment'
    );

    expect(result).toBe(true);
  });

  it('allows mismatched signatures only when development override is enabled', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_ALLOW_INVALID_SIGNATURE = 'true';
    vi.stubEnv('NODE_ENV', 'development');

    const { verifyMercadoPagoSignature } = await import('../route');

    const headers = new Headers();
    headers.set('x-request-id', 'request-abc');
    headers.set('x-signature', 'ts=1717094400,v1=wrong-signature');

    const result = verifyMercadoPagoSignature(
      headers,
      '',
      'https://example.com/api/webhooks/mercadopago?id=12345&topic=payment'
    );

    expect(result).toBe(true);
  });

  it('does not allow mismatched signatures in production even when override is enabled', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_ALLOW_INVALID_SIGNATURE = 'true';
    vi.stubEnv('NODE_ENV', 'production');

    const { verifyMercadoPagoSignature } = await import('../route');

    const headers = new Headers();
    headers.set('x-request-id', 'request-abc');
    headers.set('x-signature', 'ts=1717094400,v1=wrong-signature');

    const result = verifyMercadoPagoSignature(
      headers,
      '',
      'https://example.com/api/webhooks/mercadopago?id=12345&topic=payment'
    );

    expect(result).toBe(false);
  });
});

describe('POST /api/webhooks/mercadopago', () => {
  it('returns 401 when signature is invalid', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'my-secret-key';

    const { POST } = await import('../route');

    const request = new Request('https://example.com/api/webhooks/mercadopago?data.id=12345', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'request-abc',
        'x-signature': 'ts=1717094400,v1=invalid',
      },
      body: JSON.stringify({ action: 'payment.updated', data: { id: '12345' } }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(processMercadoPagoWebhookMock).not.toHaveBeenCalled();
  });

  it('uses paymentId hint to resolve owner and skips integration iteration', async () => {
    const secret = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;

    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'pay-hint-1',
      reservationId: 'res-1',
      reservation: { userId: 'owner-1' },
    });
    getMercadoPagoTokenMock.mockResolvedValue('owner-token');

    const paymentFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'approved',
        external_reference: 'res-1:pay-hint-1:123456',
        preference_id: 'pref-1',
        date_approved: '2026-01-01T00:00:00.000Z',
      }),
    });
    global.fetch = paymentFetch as any;

    const { POST } = await import('../route');

    const ts = '1717094400';
    const requestId = 'request-abc';
    const manifest = buildManifest('mp-payment-123', requestId, ts);
    const validSignature = computeSignature(secret, manifest);

    const request = new Request('https://example.com/api/webhooks/mercadopago?data.id=mp-payment-123&paymentId=pay-hint-1', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
        'x-signature': `ts=${ts},v1=${validSignature}`,
      },
      body: JSON.stringify({ action: 'payment.updated', data: { id: 'mp-payment-123' } }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prismaMock.userIntegration.findMany).not.toHaveBeenCalled();
    expect(processMercadoPagoWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({ hintedPaymentId: 'pay-hint-1' })
    );
  });

  it('processes query-only payment notifications with paymentId hint', async () => {
    const secret = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;

    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'pay-hint-1',
      reservationId: 'res-1',
      reservation: { userId: 'owner-1' },
    });
    getMercadoPagoTokenMock.mockResolvedValue('owner-token');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'approved',
        external_reference: 'res-1:pay-hint-1:123456',
        preference_id: 'pref-1',
      }),
    }) as any;

    const { POST } = await import('../route');

    const ts = '1717094400';
    const requestId = 'request-abc';
    const manifest = buildManifest('mp-payment-123', requestId, ts);
    const validSignature = computeSignature(secret, manifest);

    const request = new Request('https://example.com/api/webhooks/mercadopago?id=mp-payment-123&topic=payment&paymentId=pay-hint-1', {
      method: 'POST',
      headers: {
        'x-request-id': requestId,
        'x-signature': `ts=${ts},v1=${validSignature}`,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(processMercadoPagoWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mp-payment-123',
        hintedPaymentId: 'pay-hint-1',
      })
    );
  });

  it('uses paymentId hint to fetch merchant_order with the payment owner token', async () => {
    const secret = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;

    prismaMock.payment.findFirst
      .mockResolvedValueOnce({
        id: 'pay-hint-1',
        reservationId: 'res-1',
        reservation: { userId: 'owner-1' },
      })
      .mockResolvedValueOnce(null);
    getMercadoPagoTokenMock.mockResolvedValue('owner-token');

    const paymentFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          external_reference: 'res-1:pay-hint-1:123456',
          payments: [{ id: 'mp-payment-123', status: 'approved', preference_id: 'pref-1' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'approved',
          external_reference: 'res-1:pay-hint-1:123456',
          preference_id: 'pref-1',
          date_approved: '2026-01-01T00:00:00.000Z',
        }),
      });
    global.fetch = paymentFetch as any;

    const { POST } = await import('../route');

    const ts = '1717094400';
    const requestId = 'request-abc';
    const manifest = buildManifest('merchant-order-123', requestId, ts);
    const validSignature = computeSignature(secret, manifest);

    const request = new Request('https://example.com/api/webhooks/mercadopago?id=merchant-order-123&topic=merchant_order&paymentId=pay-hint-1', {
      method: 'POST',
      headers: {
        'x-request-id': requestId,
        'x-signature': `ts=${ts},v1=${validSignature}`,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prismaMock.userIntegration.findMany).not.toHaveBeenCalled();
    expect(paymentFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.mercadopago.com/merchant_orders/merchant-order-123',
      expect.objectContaining({ headers: { Authorization: 'Bearer owner-token' } })
    );
    expect(processMercadoPagoWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mp-payment-123',
        hintedPaymentId: 'pay-hint-1',
      })
    );
  });
});
