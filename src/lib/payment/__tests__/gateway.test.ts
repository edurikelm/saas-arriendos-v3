import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoGateway } from '../gateway';

const mockProcessMercadoPagoWebhook = vi.hoisted(() => vi.fn());
const mockGetMercadoPagoToken = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  reservation: { findFirst: vi.fn() },
  payment: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
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

describe('createPaymentLink - expires preference', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'pref-1',
          init_point: 'https://mp.com/checkout',
        }),
        { status: 200 }
      )
    );
    global.fetch = fetchSpy as any;
  });

  it('includes expires and expiration_date_to in preference body', async () => {
    const gateway = new MercadoPagoGateway('user-1', 'token');

    // Mock prisma reservation.findFirst
    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValueOnce({
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      checkIn: new Date('2026-08-01'),
      checkOut: new Date('2026-08-05'),
      totalPrice: 100000,
      status: 'CONFIRMED',
      createdAt: new Date(),
      updatedAt: new Date(),
      client: { id: 'client-1', name: 'Test Client', email: 'test@test.com', phone: '123', documentType: 'RUT', documentNumber: '12345678', createdAt: new Date(), updatedAt: new Date() },
      property: { id: 'prop-1', name: 'Test Property', userId: 'user-1', address: '123 Test St', city: 'Santiago', region: 'RM', country: 'CL', createdAt: new Date(), updatedAt: new Date(), maxGuests: 4 },
    });

    // Mock prisma payment.create
    vi.mocked(mockPrisma.payment.create).mockResolvedValueOnce({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 100000,
      method: 'MERCADO_PAGO' as const,
      status: 'PENDING' as const,
      mercadoPagoId: 'temp_123',
      initPoint: null,
      expiresAt: new Date('2026-08-11T15:30:00.000-04:00'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await gateway.createPaymentLink('res-1');

    const [, options] = fetchSpy.mock.calls[0];
    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.expires).toBe(true);
    expect(parsedBody.expiration_date_from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    expect(parsedBody.expiration_date_to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  });

  it('uses ISO 8601 format with offset for expiration dates', async () => {
    const gateway = new MercadoPagoGateway('user-1', 'token');

    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValueOnce({
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      checkIn: new Date('2026-08-01'),
      checkOut: new Date('2026-08-05'),
      totalPrice: 100000,
      status: 'CONFIRMED',
      createdAt: new Date(),
      updatedAt: new Date(),
      client: { id: 'client-1', name: 'Test Client', email: 'test@test.com', phone: '123', documentType: 'RUT', documentNumber: '12345678', createdAt: new Date(), updatedAt: new Date() },
      property: { id: 'prop-1', name: 'Test Property', userId: 'user-1', address: '123 Test St', city: 'Santiago', region: 'RM', country: 'CL', createdAt: new Date(), updatedAt: new Date(), maxGuests: 4 },
    });

    vi.mocked(mockPrisma.payment.create).mockResolvedValueOnce({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 100000,
      method: 'MERCADO_PAGO' as const,
      status: 'PENDING' as const,
      mercadoPagoId: 'temp_123',
      initPoint: null,
      expiresAt: new Date('2026-08-11T15:30:00.000-04:00'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await gateway.createPaymentLink('res-1');

    const [, options] = fetchSpy.mock.calls[0];
    const parsedBody = JSON.parse(options.body);

    // Verify ISO 8601 with offset format (not Z suffix)
    expect(parsedBody.expiration_date_from).not.toMatch(/Z$/);
    expect(parsedBody.expiration_date_to).not.toMatch(/Z$/);

    // Verify matches the expected pattern with offset
    expect(parsedBody.expiration_date_from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    expect(parsedBody.expiration_date_to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  });
});
