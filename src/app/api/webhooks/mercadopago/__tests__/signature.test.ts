import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';

vi.mock('@/lib/actions/payments', () => ({
  processMercadoPagoWebhook: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

function computeSignature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf-8').digest('hex');
}

describe('verifyMercadoPagoSignature', () => {
  it('returns true when MERCADOPAGO_WEBHOOK_SECRET is not configured (backward compat)', async () => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;

    const { verifyMercadoPagoSignature } = await import('../route');

    const headers = new Headers();
    const result = verifyMercadoPagoSignature(headers, '{}');

    expect(result).toBe(true);
  });

  it('returns false when secret is configured but x-signature header is missing', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'my-secret-key';

    const { verifyMercadoPagoSignature } = await import('../route');

    const headers = new Headers();
    const result = verifyMercadoPagoSignature(headers, '{"action":"payment"}');

    expect(result).toBe(false);
  });

  it('returns false when signature does not match', async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'my-secret-key';

    const { verifyMercadoPagoSignature } = await import('../route');

    const headers = new Headers();
    headers.set('x-signature', 'wrong-signature');
    const result = verifyMercadoPagoSignature(headers, '{"action":"payment"}');

    expect(result).toBe(false);
  });

  it('returns true when signature matches correctly', async () => {
    const secret = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;

    const { verifyMercadoPagoSignature } = await import('../route');

    const rawBody = '{"action":"payment.updated","data":{"id":"12345"}}';
    const validSignature = computeSignature(secret, rawBody);

    const headers = new Headers();
    headers.set('x-signature', validSignature);
    const result = verifyMercadoPagoSignature(headers, rawBody);

    expect(result).toBe(true);
  });

  it('falls back to x-request-id header when x-signature is not present', async () => {
    const secret = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;

    const { verifyMercadoPagoSignature } = await import('../route');

    const rawBody = '{"action":"payment.updated","data":{"id":"12345"}}';
    const validSignature = computeSignature(secret, rawBody);

    const headers = new Headers();
    headers.set('x-request-id', validSignature);
    const result = verifyMercadoPagoSignature(headers, rawBody);

    expect(result).toBe(true);
  });

  it('prefers x-signature over x-request-id when both are present', async () => {
    const secret = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;

    const { verifyMercadoPagoSignature } = await import('../route');

    const rawBody = '{"action":"payment.updated","data":{"id":"12345"}}';
    const validSignature = computeSignature(secret, rawBody);

    const headers = new Headers();
    headers.set('x-signature', validSignature);
    headers.set('x-request-id', 'wrong-value');
    const result = verifyMercadoPagoSignature(headers, rawBody);

    expect(result).toBe(true);
  });

  it('detects tampered body (different body than what was signed)', async () => {
    const secret = 'my-secret-key';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;

    const { verifyMercadoPagoSignature } = await import('../route');

    const originalBody = '{"action":"payment.updated","data":{"id":"12345"}}';
    const validSignature = computeSignature(secret, originalBody);

    const headers = new Headers();
    headers.set('x-signature', validSignature);
    const result = verifyMercadoPagoSignature(headers, '{"action":"payment.updated","data":{"id":"malicious"}}');

    expect(result).toBe(false);
  });
});
