// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    reservation: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/actions/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/actions/mercado-pago', () => ({
  getMercadoPagoToken: vi.fn(),
}));

describe('MercadoPagoGateway.handleWebhook - delegates to processMercadoPagoWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates correctly and returns PaymentEvent with proper shape when payment is COMPLETED', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { MercadoPagoGateway } = await import('../gateway');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: 'https://mercadopago.com/tx',
      expiresAt: new Date('2025-12-01'),
      deletedAt: null,
      mercadoPagoId: 'mp-123',
      receiptUrl: null,
      paidAt: null,
      createdAt: new Date(),
      reservation: {
        id: 'res-1',
        userId: 'user-1',
        totalPrice: 100000 as any,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-10'),
        billingType: 'DAILY' as const,
        unitsBooked: 1,
        status: 'PENDING' as const,
        propertyId: 'prop-1',
        clientId: 'client-1',
        bookingAirbnb: false,
        notes: null,
        createdAt: new Date(),
      },
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-1',
        reservationId: 'res-1',
        amount: 50000 as any,
        method: 'MERCADO_PAGO',
        status: 'COMPLETED',
        initPoint: 'https://mercadopago.com/tx',
        expiresAt: new Date('2025-12-01'),
        deletedAt: null,
        mercadoPagoId: 'mp-123',
        receiptUrl: null,
        createdAt: new Date(),
      },
    ]);

    const gateway = new MercadoPagoGateway('user-1', 'fake-token');
    const result = await gateway.handleWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
    });

    expect(result).toHaveProperty('paymentId', 'mp-123');
    expect(result).toHaveProperty('status', 'COMPLETED');
    expect(prisma.payment.update).toHaveBeenCalled();
  });

  it('returns payment not found error when payment does not exist', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { MercadoPagoGateway } = await import('../gateway');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);

    const gateway = new MercadoPagoGateway('user-1', 'fake-token');

    await expect(
      gateway.handleWebhook({
        id: 'nonexistent',
        status: 'approved',
        external_reference: 'bad-ref',
      })
    ).rejects.toThrow('Pago no encontrado');
  });

  it('handles idempotency — duplicate webhooks return properly (skipped)', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { MercadoPagoGateway } = await import('../gateway');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'COMPLETED',
      initPoint: 'https://mercadopago.com/tx',
      expiresAt: new Date('2025-12-01'),
      deletedAt: null,
      mercadoPagoId: 'mp-123',
      receiptUrl: 'https://mercadopago.com/receipt/mp-123',
      paidAt: new Date('2025-01-15T10:00:00Z'),
      createdAt: new Date(),
      reservation: {
        id: 'res-1',
        userId: 'user-1',
        totalPrice: 100000 as any,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-10'),
        billingType: 'DAILY' as const,
        unitsBooked: 1,
        status: 'PENDING' as const,
        propertyId: 'prop-1',
        clientId: 'client-1',
        bookingAirbnb: false,
        notes: null,
        createdAt: new Date(),
      },
    });

    const gateway = new MercadoPagoGateway('user-1', 'fake-token');
    const result = await gateway.handleWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
    });

    expect(result).toHaveProperty('paymentId', 'mp-123');
    expect(result).toHaveProperty('status', 'COMPLETED');
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('sets paidAt via delegation when status is COMPLETED', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { MercadoPagoGateway } = await import('../gateway');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: 'https://mercadopago.com/tx',
      expiresAt: new Date('2025-12-01'),
      deletedAt: null,
      mercadoPagoId: 'mp-123',
      receiptUrl: null,
      paidAt: null,
      createdAt: new Date(),
      reservation: {
        id: 'res-1',
        userId: 'user-1',
        totalPrice: 100000 as any,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-10'),
        billingType: 'DAILY' as const,
        unitsBooked: 1,
        status: 'PENDING' as const,
        propertyId: 'prop-1',
        clientId: 'client-1',
        bookingAirbnb: false,
        notes: null,
        createdAt: new Date(),
      },
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const gateway = new MercadoPagoGateway('user-1', 'fake-token');
    await gateway.handleWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
    });

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          paidAt: expect.any(Date),
        }),
      })
    );
  });

  it('saves receiptUrl via delegation', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { MercadoPagoGateway } = await import('../gateway');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: 'https://mercadopago.com/tx',
      expiresAt: new Date('2025-12-01'),
      deletedAt: null,
      mercadoPagoId: 'mp-123',
      receiptUrl: null,
      paidAt: null,
      createdAt: new Date(),
      reservation: {
        id: 'res-1',
        userId: 'user-1',
        totalPrice: 100000 as any,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-10'),
        billingType: 'DAILY' as const,
        unitsBooked: 1,
        status: 'PENDING' as const,
        propertyId: 'prop-1',
        clientId: 'client-1',
        bookingAirbnb: false,
        notes: null,
        createdAt: new Date(),
      },
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const gateway = new MercadoPagoGateway('user-1', 'fake-token');
    await gateway.handleWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
      receipt_url: 'https://mercadopago.com/receipt/mp-123',
    });

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          receiptUrl: 'https://mercadopago.com/receipt/mp-123',
        }),
      })
    );
  });

  it('uses date_approved for paidAt via delegation', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { MercadoPagoGateway } = await import('../gateway');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: 'https://mercadopago.com/tx',
      expiresAt: new Date('2025-12-01'),
      deletedAt: null,
      mercadoPagoId: 'mp-123',
      receiptUrl: null,
      paidAt: null,
      createdAt: new Date(),
      reservation: {
        id: 'res-1',
        userId: 'user-1',
        totalPrice: 100000 as any,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-10'),
        billingType: 'DAILY' as const,
        unitsBooked: 1,
        status: 'PENDING' as const,
        propertyId: 'prop-1',
        clientId: 'client-1',
        bookingAirbnb: false,
        notes: null,
        createdAt: new Date(),
      },
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const gateway = new MercadoPagoGateway('user-1', 'fake-token');
    await gateway.handleWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
      date_approved: '2025-06-15T14:30:00.000Z',
    });

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAt: new Date('2025-06-15T14:30:00.000Z'),
        }),
      })
    );
  });

  it('updates payment from FAILED to COMPLETED (status change allowed)', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { MercadoPagoGateway } = await import('../gateway');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'FAILED',
      initPoint: 'https://mercadopago.com/tx',
      expiresAt: new Date('2025-12-01'),
      deletedAt: null,
      mercadoPagoId: 'mp-123',
      receiptUrl: null,
      paidAt: null,
      createdAt: new Date(),
      reservation: {
        id: 'res-1',
        userId: 'user-1',
        totalPrice: 100000 as any,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-10'),
        billingType: 'DAILY' as const,
        unitsBooked: 1,
        status: 'PENDING' as const,
        propertyId: 'prop-1',
        clientId: 'client-1',
        bookingAirbnb: false,
        notes: null,
        createdAt: new Date(),
      },
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const gateway = new MercadoPagoGateway('user-1', 'fake-token');
    const result = await gateway.handleWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
    });

    expect(result).toHaveProperty('status', 'COMPLETED');
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    );
  });
});

describe('UUID regex — CUID compatibility', () => {
  it('accepts valid CUIDs (letters a-z + numbers)', () => {
    const regex = /^[a-z0-9]{20,}$/i;
    expect(regex.test('cm97abc123def456789012')).toBe(true);
    expect(regex.test('clhn9kkj60000l208d3og2bxz')).toBe(true);
  });

  it('rejects old hex-only regex test values', () => {
    const oldRegex = /^[a-f0-9]{20,}$/i;
    const newRegex = /^[a-z0-9]{20,}$/i;
    expect(oldRegex.test('clhn9kkj60000l208d3og2bxz')).toBe(false);
    expect(newRegex.test('clhn9kkj60000l208d3og2bxz')).toBe(true);
  });
});

describe('MercadoPagoGateway.createPaymentLink — external_reference format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes paymentId in external_reference (3-part format: resId:paymentId:timestamp)', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { MercadoPagoGateway } = await import('../gateway');

    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-10'),
      billingType: 'DAILY' as const,
      unitsBooked: 1,
      totalPrice: 100000 as any,
      status: 'PENDING' as const,
      bookingAirbnb: false,
      notes: null,
      createdAt: new Date(),
      property: { id: 'prop-1', name: 'Casa', userId: 'user-1' },
      client: { id: 'client-1', name: 'Juan', email: 'juan@test.com', phone: '+123456' },
    });

    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    let externalRefUsed: string | undefined;

    process.env.NEXT_PUBLIC_APP_URL = 'https://rentalpro.test';

    let notificationUrlUsed: string | undefined;
    let backUrlsUsed: Record<string, string> | undefined;
    let autoReturnUsed: string | undefined;

    const mockFetch = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body as string);
      externalRefUsed = body.external_reference;
      notificationUrlUsed = body.notification_url;
      backUrlsUsed = body.back_urls;
      autoReturnUsed = body.auto_return;

      return {
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'mp-pref-123',
            init_point: 'https://mercadopago.com/tx',
            sandbox_init_point: 'https://sandbox.mercadopago.com/tx',
          }),
      };
    });
    global.fetch = mockFetch;

    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 100000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: null,
      expiresAt: new Date('2025-12-01'),
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    const gateway = new MercadoPagoGateway('user-1', 'fake-token');
    const result = await gateway.createPaymentLink('res-1');

    expect(externalRefUsed).toBeDefined();
    const parts = externalRefUsed!.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('res-1');
    expect(parts[1]).toBe('pay-1');
    const timestamp = parseInt(parts[2], 10);
    expect(timestamp).toBeGreaterThan(0);
    expect(notificationUrlUsed).toBe('https://rentalpro.test/api/webhooks/mercadopago?source_news=webhooks&paymentId=pay-1');
    expect(backUrlsUsed).toEqual({
      success: 'https://rentalpro.test/payment/result?paymentId=pay-1&status=success',
      pending: 'https://rentalpro.test/payment/result?paymentId=pay-1&status=pending',
      failure: 'https://rentalpro.test/payment/result?paymentId=pay-1&status=failure',
    });
    expect(autoReturnUsed).toBe('approved');
    expect(result).toHaveProperty('initPoint', 'https://mercadopago.com/tx');
    expect(result).toHaveProperty('paymentId', 'pay-1');
  });

  it('returns error when payment amount would be zero', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { MercadoPagoGateway } = await import('../gateway');

    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-10'),
      billingType: 'DAILY' as const,
      unitsBooked: 1,
      totalPrice: 50000 as any,
      status: 'PENDING' as const,
      bookingAirbnb: false,
      notes: null,
      createdAt: new Date(),
      property: { id: 'prop-1', name: 'Casa', userId: 'user-1' },
      client: { id: 'client-1', name: 'Juan', email: 'juan@test.com', phone: '+123456' },
    });

    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-0',
        reservationId: 'res-1',
        amount: 50000 as any,
        method: 'MERCADO_PAGO',
        status: 'COMPLETED',
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: 'mp-old',
        createdAt: new Date(),
      },
    ]);

    const gateway = new MercadoPagoGateway('user-1', 'fake-token');

    await expect(gateway.createPaymentLink('res-1')).rejects.toThrow('Payment amount must be greater than zero');
  });
});
