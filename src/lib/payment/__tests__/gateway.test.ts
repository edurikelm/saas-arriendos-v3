import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoGateway } from '../gateway';

const mockProcessMercadoPagoWebhook = vi.hoisted(() => vi.fn());
const mockGetMercadoPagoToken = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    reservation: { findFirst: vi.fn() },
    payment: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/actions/mercado-pago', () => ({
  getMercadoPagoToken: mockGetMercadoPagoToken,
}));

vi.mock('@/lib/actions/payments', () => ({
  processMercadoPagoWebhook: mockProcessMercadoPagoWebhook,
}));

vi.mock('@/lib/payments/queries', () => ({
  getActivePaymentsForReservation: vi.fn().mockResolvedValue([]),
}));

vi.mock('date-fns', () => ({
  addDays: vi.fn((date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }),
}));

describe('MercadoPagoGateway.handleWebhook', () => {
  let gateway: MercadoPagoGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMercadoPagoToken.mockResolvedValue('fake-token');
    gateway = new MercadoPagoGateway('user-1', 'fake-token');
  });

  it('status approved → COMPLETED', async () => {
    mockProcessMercadoPagoWebhook.mockResolvedValue({ status: 'COMPLETED' });

    const result = await gateway.handleWebhook({
      id: 'mp-payment-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123',
    });

    expect(result).toEqual({
      paymentId: 'mp-payment-123',
      status: 'COMPLETED',
    });
  });

  it('status rejected → FAILED', async () => {
    mockProcessMercadoPagoWebhook.mockResolvedValue({ status: 'FAILED' });

    const result = await gateway.handleWebhook({
      id: 'mp-payment-456',
      status: 'rejected',
      external_reference: 'res-1:pay-1:123',
    });

    expect(result).toEqual({
      paymentId: 'mp-payment-456',
      status: 'FAILED',
    });
  });

  it('status cancelled → FAILED', async () => {
    mockProcessMercadoPagoWebhook.mockResolvedValue({ status: 'FAILED' });

    const result = await gateway.handleWebhook({
      id: 'mp-payment-789',
      status: 'cancelled',
      external_reference: 'res-1:pay-1:123',
    });

    expect(result).toEqual({
      paymentId: 'mp-payment-789',
      status: 'FAILED',
    });
  });

  it('status refunded → FAILED', async () => {
    mockProcessMercadoPagoWebhook.mockResolvedValue({ status: 'FAILED' });

    const result = await gateway.handleWebhook({
      id: 'mp-payment-refund',
      status: 'refunded',
      external_reference: 'res-1:pay-1:123',
    });

    expect(result).toEqual({
      paymentId: 'mp-payment-refund',
      status: 'FAILED',
    });
  });

  it('status pending → PENDING', async () => {
    mockProcessMercadoPagoWebhook.mockResolvedValue({ status: 'PENDING' });

    const result = await gateway.handleWebhook({
      id: 'mp-payment-pending',
      status: 'pending',
      external_reference: 'res-1:pay-1:123',
    });

    expect(result).toEqual({
      paymentId: 'mp-payment-pending',
      status: 'PENDING',
    });
  });

  it('status desconocido → PENDING (default case en mapMercadoPagoStatus)', async () => {
    mockProcessMercadoPagoWebhook.mockResolvedValue({ status: 'PENDING' });

    const result = await gateway.handleWebhook({
      id: 'mp-payment-unknown',
      status: 'some_weird_status',
      external_reference: 'res-1:pay-1:123',
    });

    expect(result).toEqual({
      paymentId: 'mp-payment-unknown',
      status: 'PENDING',
    });
  });

  it('propaga error si processMercadoPagoWebhook retorna error', async () => {
    mockProcessMercadoPagoWebhook.mockResolvedValue({ error: 'Pago no encontrado' });

    await expect(
      gateway.handleWebhook({
        id: 'mp-payment-err',
        status: 'approved',
        external_reference: 'invalid-ref',
      })
    ).rejects.toThrow('Pago no encontrado');
  });

  it('propaga skipped status usando mapeo de MP cuando processMercadoPagoWebhook retorna skipped:true', async () => {
    // simulate processMercadoPagoWebhook returning skipped (no local match found)
    // so handleWebhook must fall back to mapMercadoPagoStatus using raw payload
    mockProcessMercadoPagoWebhook.mockResolvedValue({ skipped: true, status: 'PENDING' });

    const result = await gateway.handleWebhook({
      id: 'mp-payment-skipped',
      status: 'pending',
      external_reference: 'res-1:pay-1:123',
    });

    // When skipped=true, it uses mapMercadoPagoStatus(payload.status) → PENDING
    expect(result).toEqual({
      paymentId: 'mp-payment-skipped',
      status: 'PENDING',
    });
  });

  it('propaga skipped con status approved → COMPLETED', async () => {
    mockProcessMercadoPagoWebhook.mockResolvedValue({ skipped: true, status: 'COMPLETED' });

    const result = await gateway.handleWebhook({
      id: 'mp-payment-skipped-approved',
      status: 'approved',
      external_reference: 'res-1:pay-1:123',
    });

    // skipped=true → uses mapMercadoPagoStatus(payload.status) → approved → COMPLETED
    expect(result).toEqual({
      paymentId: 'mp-payment-skipped-approved',
      status: 'COMPLETED',
    });
  });
});
