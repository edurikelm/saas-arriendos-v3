import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  prismaMock,
  getMercadoPagoTokenMock,
  processMercadoPagoWebhookMock,
  buildManifest,
  computeSignature,
} from '../../__tests__/helpers';

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/actions/mercado-pago', () => ({ getMercadoPagoToken: getMercadoPagoTokenMock }));
vi.mock('@/lib/actions/payments', () => ({ processMercadoPagoWebhook: processMercadoPagoWebhookMock }));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = 'test-secret';
  // Reset mocks
  prismaMock.payment.findFirst?.mockReset();
  prismaMock.payment.findUnique?.mockReset();
  prismaMock.userIntegration.findMany?.mockReset();
  getMercadoPagoTokenMock.mockReset();
  processMercadoPagoWebhookMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('POST /api/webhooks/mercadopago - E2E integration', () => {
  it('processes valid payment webhook with paymentId hint', async () => {
    // Spy on global.fetch to mock MP API responses
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'mp-pay-1',
          status: 'approved',
          status_detail: 'accredited',
          external_reference: 'res-1:pay-1:123456',
          preference_id: 'pref-1',
          date_approved: '2026-01-01T00:00:00.000Z',
          date_created: '2026-01-01T00:00:00.000Z',
          payment_method_id: 'visa',
          payment_type: 'credit_card',
          transaction_amount: 100.0,
          net_received_amount: 95.0,
          fee_details: [{ type: 'commission', amount: 5.0 }],
          installments: 1,
          card: { last_four_digits: '1234' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const { POST } = await import('../route');

    // Mock DB: payment found via hint
    (prismaMock.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      mercadoPagoId: 'mp-pay-1',
      reservation: { userId: 'owner-1' },
    });
    getMercadoPagoTokenMock.mockResolvedValue('owner-token');
    processMercadoPagoWebhookMock.mockResolvedValue({ status: 'COMPLETED' });

    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = 'req-abc';
    const dataId = 'mp-pay-1';
    const manifest = buildManifest(dataId, requestId, ts);
    const signature = computeSignature('test-secret', manifest);

    const request = new Request(
      `https://example.com/api/webhooks/mercadopago?data.id=${dataId}&paymentId=pay-1&type=payment`,
      {
        method: 'POST',
        headers: {
          'x-request-id': requestId,
          'x-signature': `ts=${ts},v1=${signature}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'payment.updated', data: { id: dataId } }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    // Spy intercepted the MP fetch → getPaymentStatus returned mock data
    expect(processMercadoPagoWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: dataId, status: 'approved' })
    );
    // paymentId hint bypasses integration iteration
    expect(prismaMock.userIntegration.findMany).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('handles ms-style uppercase dataId correctly (lowercase fix)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'ORDTST01ABCDEF1234567890',
          status: 'approved',
          status_detail: 'accredited',
          external_reference: 'res-1:pay-1:123456',
          preference_id: 'pref-1',
          date_approved: '2026-01-01T00:00:00.000Z',
          date_created: '2026-01-01T00:00:00.000Z',
          payment_method_id: 'visa',
          payment_type: 'credit_card',
          transaction_amount: 100.0,
          net_received_amount: 95.0,
          fee_details: [],
          installments: 1,
          card: { last_four_digits: '1234' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const { POST } = await import('../route');
    const { normalizeDataId } = await import('@/lib/payment/webhook-helpers');

    // Mock DB: payment found via hint
    (prismaMock.payment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      mercadoPagoId: 'ORDTST01ABCDEF1234567890',
      reservation: { userId: 'owner-1' },
    });
    getMercadoPagoTokenMock.mockResolvedValue('owner-token');
    processMercadoPagoWebhookMock.mockResolvedValue({ status: 'COMPLETED' });

    const ts = String(Math.floor(Date.now() / 1000));
    const requestId = 'req-abc';
    const dataId = 'ORDTST01ABCDEF1234567890'; // uppercase from MP
    // MP computes HMAC using lowercase dataId
    const manifest = buildManifest(normalizeDataId(dataId), requestId, ts);
    const signature = computeSignature('test-secret', manifest);

    const request = new Request(
      `https://example.com/api/webhooks/mercadopago?data.id=${dataId}&paymentId=pay-1&type=payment`,
      {
        method: 'POST',
        headers: {
          'x-request-id': requestId,
          'x-signature': `ts=${ts},v1=${signature}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'payment.updated', data: { id: dataId } }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(processMercadoPagoWebhookMock).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects webhook with stale ts (replay protection)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const { POST } = await import('../route');

    const staleTs = String(Math.floor(Date.now() / 1000) - 6 * 60); // 6 min ago
    const requestId = 'req-abc';
    const dataId = 'mp-pay-1';
    const manifest = buildManifest(dataId, requestId, staleTs);
    const signature = computeSignature('test-secret', manifest);

    const request = new Request(
      `https://example.com/api/webhooks/mercadopago?data.id=${dataId}&type=payment`,
      {
        method: 'POST',
        headers: {
          'x-request-id': requestId,
          'x-signature': `ts=${staleTs},v1=${signature}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'payment.updated', data: { id: dataId } }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(processMercadoPagoWebhookMock).not.toHaveBeenCalled();
    // No external MP calls should have been made
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
