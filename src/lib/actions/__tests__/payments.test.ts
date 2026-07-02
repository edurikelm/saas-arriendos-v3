// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — TODO(P1-tests): migrate to per-line @ts-expect-error or proper types
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/actions/auth';

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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/actions/mercado-pago', () => ({
  getMercadoPagoToken: vi.fn(),
}));

const mockSession: SessionUser = {
  userId: 'user-1',
  role: 'OWNER',
  plan: 'PRO',
  email: 'test@test.com',
};

const mockReservation = {
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
  client: { id: 'client-1', name: 'Juan', email: 'juan@test.com', phone: '+123456' },
  property: { id: 'prop-1', name: 'Casa', userId: 'user-1' },
};

describe('deletePayment - soft delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets deletedAt instead of hard deleting', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

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
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    const { deletePayment } = await import('../payments');
    const result = await deletePayment('pay-1');

    expect(result).toHaveProperty('success', true);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('rejects payment from another user', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue({
      ...mockSession,
      userId: 'other-user',
    });

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
      createdAt: new Date(),
      reservation: { ...mockReservation, userId: 'user-1' },
    });

    const { deletePayment } = await import('../payments');
    const result = await deletePayment('pay-1');

    expect(result).toHaveProperty('error', 'No autorizado');
  });
});

describe('restorePayment - undoes soft delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears deletedAt so payment reappears in listing', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: 'https://mercadopago.com/tx',
      expiresAt: new Date('2025-12-01'),
      deletedAt: new Date(),
      mercadoPagoId: 'mp-123',
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    const { restorePayment } = await import('../payments');
    const result = await restorePayment('pay-1');

    expect(result).toHaveProperty('success', true);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { deletedAt: null },
    });
  });

  it('rejects restore from another user', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue({
      ...mockSession,
      userId: 'other-user',
    });

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: 'https://mercadopago.com/tx',
      expiresAt: new Date('2025-12-01'),
      deletedAt: new Date(),
      mercadoPagoId: 'mp-123',
      createdAt: new Date(),
      reservation: { ...mockReservation, userId: 'user-1' },
    });

    const { restorePayment } = await import('../payments');
    const result = await restorePayment('pay-1');

    expect(result).toHaveProperty('error', 'No autorizado');
  });
});

describe('getPaymentsByReservation - filters soft deleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('only returns payments where deletedAt is null', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.reservation.findFirst).mockResolvedValue(mockReservation);

    const now = new Date();
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-1',
        reservationId: 'res-1',
        amount: 50000 as any,
        method: 'MERCADO_PAGO',
        status: 'PENDING',
        initPoint: 'https://mercadopago.com/tx',
        expiresAt: new Date('2025-12-01'),
        deletedAt: null,
        mercadoPagoId: 'mp-123',
        createdAt: now,
      },
    ]);

    const { getPaymentsByReservation } = await import('../payments');
    const payments = await getPaymentsByReservation('res-1');

    expect(payments).toHaveLength(1);
    expect(payments[0].id).toBe('pay-1');
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
  });
});

describe('markPaymentAsPaid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('actualiza payment a COMPLETED con paidAt y method', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const paidAtDate = new Date('2025-06-15');
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'CASH',
      status: 'PENDING',
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'TRANSFER' as any,
      status: 'COMPLETED',
      paidAt: paidAtDate,
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);

    const { markPaymentAsPaid } = await import('../payments');
    const result = await markPaymentAsPaid('pay-1', paidAtDate, 'TRANSFER');

    expect(result).toHaveProperty('success', true);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: {
        status: 'COMPLETED',
        paidAt: paidAtDate,
        method: 'TRANSFER',
      },
    });
  });

  it('retorna error si el payment no existe', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);

    const { markPaymentAsPaid } = await import('../payments');
    const result = await markPaymentAsPaid('non-existent', new Date(), 'CASH');

    expect(result).toHaveProperty('error', 'Pago no encontrado');
  });

  it('retorna error si el payment ya está COMPLETED', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'CASH',
      status: 'COMPLETED',
      paidAt: new Date('2025-01-01'),
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: mockReservation,
    });

    const { markPaymentAsPaid } = await import('../payments');
    const result = await markPaymentAsPaid('pay-1', new Date(), 'CASH');

    expect(result).toHaveProperty('error', 'El pago ya está completado');
  });

  it('validar que paidAt es la fecha correcta', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const paidAtDate = new Date('2025-06-15T10:30:00');
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'CASH',
      status: 'PENDING',
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockImplementation(async ({ data }) => {
      expect(data.paidAt).toEqual(paidAtDate);
      return {} as any;
    });

    const { markPaymentAsPaid } = await import('../payments');
    const result = await markPaymentAsPaid('pay-1', paidAtDate, 'TRANSFER');

    expect(result).toHaveProperty('success', true);
  });
});

describe('generatePaymentLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if payment not found', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);

    const { generatePaymentLink } = await import('../payments');
    const result = await generatePaymentLink('nonexistent');

    expect(result).toHaveProperty('error', 'Pago no encontrado');
  });

  it('returns error if payment is not PENDING', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'COMPLETED',
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: mockReservation,
    });

    const { generatePaymentLink } = await import('../payments');
    const result = await generatePaymentLink('pay-1');

    expect(result).toHaveProperty('error', 'No se puede generar link para un pago con estado COMPLETED');
  });

  it('returns error if payment method is not MERCADO_PAGO', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'CASH',
      status: 'PENDING',
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: mockReservation,
    });

    const { generatePaymentLink } = await import('../payments');
    const result = await generatePaymentLink('pay-1');

    expect(result).toHaveProperty('error', 'Solo pagos de Mercado Pago pueden generar links');
  });

  it('generates initPoint for PENDING payment without initPoint', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue('fake-token');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'mp-new-id',
        init_point: 'https://mercadopago.com/new-link',
        sandbox_init_point: 'https://sandbox.mercadopago.com/new-link',
      }),
    });
    global.fetch = mockFetch;

    const { generatePaymentLink } = await import('../payments');
    const result = await generatePaymentLink('pay-1');

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('initPoint', 'https://mercadopago.com/new-link');
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: expect.objectContaining({
        initPoint: 'https://mercadopago.com/new-link',
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('updates expiresAt to 7 days from now', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue('fake-token');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: mockReservation,
    });

    const now = new Date();
    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'mp-new-id',
        init_point: 'https://mercadopago.com/new-link',
        sandbox_init_point: 'https://sandbox.mercadopago.com/new-link',
      }),
    });
    global.fetch = mockFetch;

    const { generatePaymentLink } = await import('../payments');
    const result = await generatePaymentLink('pay-1');

    expect(result).toHaveProperty('success', true);
    const updateCall = prisma.payment.update.mock.calls[0];
    const expiresAt = updateCall[0].data.expiresAt as Date;
    const expectedExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(5000);
  });

  it('sends notification hint and redirect back_urls in preference payload', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    process.env.NEXT_PUBLIC_APP_URL = 'https://rentalpro.test';
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue('fake-token');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'mp-new-id',
        init_point: 'https://mercadopago.com/new-link',
        sandbox_init_point: 'https://sandbox.mercadopago.com/new-link',
      }),
    });
    global.fetch = mockFetch;

    const { generatePaymentLink } = await import('../payments');
    await generatePaymentLink('pay-1');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);

    expect(body.notification_url).toBe('https://rentalpro.test/api/webhooks/mercadopago?source_news=webhooks&paymentId=pay-1');
    expect(body.back_urls).toEqual({
      success: 'https://rentalpro.test/payment/result?paymentId=pay-1&status=success',
      pending: 'https://rentalpro.test/payment/result?paymentId=pay-1&status=pending',
      failure: 'https://rentalpro.test/payment/result?paymentId=pay-1&status=failure',
    });
    expect(body.auto_return).toBe('approved');
  });
});

describe('processMercadoPagoWebhook - receipt_url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('guarda receipt_url en Payment cuando webhook recibe payment con receipt_url', async () => {
    const { prisma } = await import('@/lib/db/prisma');

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
      createdAt: new Date(),
      reservation: mockReservation,
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
        receiptUrl: 'https://mercadopago.com/receipt/mp-123',
        createdAt: new Date(),
      },
    ]);

    const { processMercadoPagoWebhook } = await import('../payments');
    const result = await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-123',
      receipt_url: 'https://mercadopago.com/receipt/mp-123',
    });

    expect(result).toHaveProperty('success', true);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: expect.objectContaining({
        receiptUrl: 'https://mercadopago.com/receipt/mp-123',
      }),
    });
  });

  it('no sobreescribe receiptUrl si no viene en webhook', async () => {
    const { prisma } = await import('@/lib/db/prisma');

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
      createdAt: new Date(),
      reservation: mockReservation,
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

    const { processMercadoPagoWebhook } = await import('../payments');
    const result = await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-123',
    });

    expect(result).toHaveProperty('success', true);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: expect.not.objectContaining(['receiptUrl']),
    });
  });
});

describe('processMercadoPagoWebhook - idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips update when payment is already COMPLETED and webhook sends approved (duplicate)', async () => {
    const { prisma } = await import('@/lib/db/prisma');

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
      reservation: mockReservation,
    });

    const { processMercadoPagoWebhook } = await import('../payments');
    const result = await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-123',
    });

    expect(result).toEqual({ success: true, skipped: true });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('updates payment when status differs (PENDING -> COMPLETED)', async () => {
    const { prisma } = await import('@/lib/db/prisma');

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
      createdAt: new Date(),
      reservation: mockReservation,
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

    const { processMercadoPagoWebhook } = await import('../payments');
    const result = await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-123',
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('status', 'COMPLETED');
    expect(prisma.payment.update).toHaveBeenCalledTimes(1);
  });

  it('updates payment from FAILED to COMPLETED (MP correction allowed)', async () => {
    const { prisma } = await import('@/lib/db/prisma');

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
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { processMercadoPagoWebhook } = await import('../payments');
    const result = await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-123',
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('status', 'COMPLETED');
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    );
  });

  it('skips update when payment is PENDING and webhook status maps to PENDING', async () => {
    const { prisma } = await import('@/lib/db/prisma');

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
      createdAt: new Date(),
      reservation: mockReservation,
    });

    const { processMercadoPagoWebhook } = await import('../payments');
    const result = await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'pending',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-123',
    });

    expect(result).toEqual({ success: true, skipped: true });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('updates payment when COMPLETED payment receives a rejected webhook', async () => {
    const { prisma } = await import('@/lib/db/prisma');

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
      receiptUrl: null,
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    const { processMercadoPagoWebhook } = await import('../payments');
    const result = await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'rejected',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-123',
    });

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('status', 'FAILED');
    expect(prisma.payment.update).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite paidAt on duplicate approved webhooks to a COMPLETED payment', async () => {
    const { prisma } = await import('@/lib/db/prisma');

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
      reservation: mockReservation,
    });

    const { processMercadoPagoWebhook } = await import('../payments');
    await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-123',
    });

    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});

describe('processMercadoPagoWebhook - matching order and coherence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tries hintedPaymentId first, then external_reference paymentId, then preference_id, then mercadoPagoId', async () => {
    const { prisma } = await import('@/lib/db/prisma');

    vi.mocked(prisma.payment.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'pay-1',
        reservationId: 'res-1',
        amount: 50000 as any,
        method: 'MERCADO_PAGO',
        status: 'PENDING',
        initPoint: 'https://mercadopago.com/tx',
        expiresAt: new Date('2025-12-01'),
        deletedAt: null,
        mercadoPagoId: 'mp-123',
        createdAt: new Date(),
        reservation: mockReservation,
      });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { processMercadoPagoWebhook } = await import('../payments');
    await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:clhn9kkj60000l208d3og2bxz:123456',
      preference_id: 'pref-123',
      hintedPaymentId: 'pay-hint-1',
    });

    const calls = vi.mocked(prisma.payment.findFirst).mock.calls;
    expect(calls[0][0]).toEqual(expect.objectContaining({ where: expect.objectContaining({ id: 'pay-hint-1' }) }));
    expect(calls[1][0]).toEqual(expect.objectContaining({ where: expect.objectContaining({ id: 'clhn9kkj60000l208d3og2bxz' }) }));
    expect(calls[2][0]).toEqual(expect.objectContaining({ where: expect.objectContaining({ mercadoPagoId: 'pref-123' }) }));
    expect(calls[3][0]).toEqual(expect.objectContaining({ where: expect.objectContaining({ mercadoPagoId: 'mp-123' }) }));
  });

  it('rejects candidate when reservationId from external_reference does not match payment reservation', async () => {
    const { prisma } = await import('@/lib/db/prisma');

    vi.mocked(prisma.payment.findFirst)
      .mockResolvedValueOnce({
        id: 'clhn9kkj60000l208d3og2bxz',
        reservationId: 'res-2',
        amount: 50000 as any,
        method: 'MERCADO_PAGO',
        status: 'PENDING',
        initPoint: 'https://mercadopago.com/tx',
        expiresAt: new Date('2025-12-01'),
        deletedAt: null,
        mercadoPagoId: 'pref-123',
        createdAt: new Date(),
        reservation: { ...mockReservation, id: 'res-2' },
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const { processMercadoPagoWebhook } = await import('../payments');
    const result = await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:clhn9kkj60000l208d3og2bxz:123456',
      preference_id: 'pref-123',
    });

    expect(result).toEqual({ error: 'Pago no encontrado' });
  });
});

describe('createPayment - paymentType EXTRA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips maxAmount validation when paymentType is EXTRA', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    });

    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-1',
        reservationId: 'res-1',
        amount: 100000 as any,
        method: 'CASH',
        status: 'COMPLETED',
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: null,
        createdAt: new Date(),
      },
    ]);

    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay-2',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'CASH',
      status: 'COMPLETED',
      paymentType: 'EXTRA',
      title: 'Multa',
      description: null,
      initPoint: null,
      expiresAt: null,
      paidAt: null,
      receiptUrl: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);

    const { createPayment } = await import('../payments');
    const result = await createPayment({
      reservationId: 'res-1',
      amount: 50000,
      method: 'CASH',
      paymentType: 'EXTRA',
      title: 'Multa',
    });

    expect(result).toHaveProperty('success', true);
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
  });

  it('returns error when paymentType is EXTRA without title', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.reservation.findFirst).mockResolvedValue(mockReservation);

    const { createPayment } = await import('../payments');
    const result = await createPayment({
      reservationId: 'res-1',
      amount: 50000,
      method: 'CASH',
      paymentType: 'EXTRA',
    });

    expect(result).toHaveProperty('error');
  });

  it('still enforces maxAmount validation for RESERVATION payments', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    });

    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-1',
        reservationId: 'res-1',
        amount: 100000 as any,
        method: 'CASH',
        status: 'COMPLETED',
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: null,
        createdAt: new Date(),
      },
    ]);

    const { createPayment } = await import('../payments');
    const result = await createPayment({
      reservationId: 'res-1',
      amount: 50000,
      method: 'CASH',
    });

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('excede');
  });
});

describe('regeneratePaymentLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when link has not expired yet', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: 'https://mercadopago.com/tx',
      expiresAt: new Date('2030-12-01'),
      deletedAt: null,
      mercadoPagoId: 'mp-123',
      createdAt: new Date(),
      reservation: mockReservation,
    });

    const { regeneratePaymentLink } = await import('../payments');
    const result = await regeneratePaymentLink('pay-1');

    expect(result).toHaveProperty('error', 'El link actual aún no ha expirado');
  });

  it('returns error when payment method is not MERCADO_PAGO', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'TRANSFER',
      status: 'PENDING',
      initPoint: null,
      expiresAt: new Date('2020-01-01'),
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: mockReservation,
    });

    const { regeneratePaymentLink } = await import('../payments');
    const result = await regeneratePaymentLink('pay-1');

    expect(result).toHaveProperty('error', 'Solo pagos de Mercado Pago pueden regenerar links');
  });

  it('generates new link when expired', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue('fake-token');

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: 'https://mercadopago.com/old',
      expiresAt: new Date('2020-01-01'),
      deletedAt: null,
      mercadoPagoId: 'mp-123',
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    process.env.NEXT_PUBLIC_APP_URL = 'https://rentalpro.test';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'new-mp-id',
        init_point: 'https://mercadopago.com/new',
        sandbox_init_point: 'https://sandbox.mercadopago.com/new',
        expiration_date: new Date('2030-01-01').toISOString(),
      }),
    });
    global.fetch = mockFetch;

    const { regeneratePaymentLink } = await import('../payments');
    const result = await regeneratePaymentLink('pay-1');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('initPoint', 'https://mercadopago.com/new');
    expect(body.notification_url).toBe('https://rentalpro.test/api/webhooks/mercadopago?source_news=webhooks&paymentId=pay-1');
    expect(body.auto_return).toBe('approved');
  });
});

describe('processMercadoPagoWebhook - date_approved', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses date_approved from MP for paidAt when provided', async () => {
    const { prisma } = await import('@/lib/db/prisma');

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
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { processMercadoPagoWebhook } = await import('../payments');
    await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-123',
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

  it('falls back to new Date() when date_approved is not provided', async () => {
    const { prisma } = await import('@/lib/db/prisma');

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
      createdAt: new Date(),
      reservation: mockReservation,
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const before = new Date();

    const { processMercadoPagoWebhook } = await import('../payments');
    await processMercadoPagoWebhook({
      id: 'mp-123',
      status: 'approved',
      external_reference: 'res-1:pay-1:123456',
      preference_id: 'pref-123',
    });

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAt: expect.any(Date),
        }),
      })
    );

    const updateCall = vi.mocked(prisma.payment.update).mock.calls[0];
    const paidAt = (updateCall[0] as any).data.paidAt as Date;
    expect(paidAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe('generateMercadoPagoLink - per-user token only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when user has no Mercado Pago token configured', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue(null);

    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    } as any);

    const { generateMercadoPagoLink } = await import('../payments');
    const result = await generateMercadoPagoLink('res-1');

    expect(result).toHaveProperty('error', 'Conecta tu cuenta de Mercado Pago en Settings');
  });

  it('does NOT fall back to global env token', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue(null);

    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-GLOBAL-TOKEN';

    const { generateMercadoPagoLink } = await import('../payments');
    const result = await generateMercadoPagoLink('res-1');

    delete process.env.MERCADOPAGO_ACCESS_TOKEN;

    expect(result).toHaveProperty('error', 'Conecta tu cuenta de Mercado Pago en Settings');
  });

  it('includes paymentId hint and back_urls in preference payload', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    process.env.NEXT_PUBLIC_APP_URL = 'https://rentalpro.test';
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue('fake-token');

    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    } as any);

    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 100000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: null,
      expiresAt: new Date('2030-01-01'),
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'mp-pref-1',
        init_point: 'https://mercadopago.com/new-link',
        sandbox_init_point: 'https://sandbox.mercadopago.com/new-link',
      }),
    });
    global.fetch = mockFetch;

    const { generateMercadoPagoLink } = await import('../payments');
    await generateMercadoPagoLink('res-1');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);

    expect(body.notification_url).toBe('https://rentalpro.test/api/webhooks/mercadopago?source_news=webhooks&paymentId=pay-1');
    expect(body.back_urls).toEqual({
      success: 'https://rentalpro.test/payment/result?paymentId=pay-1&status=success',
      pending: 'https://rentalpro.test/payment/result?paymentId=pay-1&status=pending',
      failure: 'https://rentalpro.test/payment/result?paymentId=pay-1&status=failure',
    });
    expect(body.auto_return).toBe('approved');
  });
});

describe('generatePaymentLink - per-user token only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when user has no token (no global fallback)', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue(null);

    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-1',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      initPoint: null,
      expiresAt: new Date('2025-12-01'),
      deletedAt: null,
      mercadoPagoId: 'mp-123',
      createdAt: new Date(),
      reservation: mockReservation,
    });

    const { generatePaymentLink } = await import('../payments');
    const result = await generatePaymentLink('pay-1');

    expect(result).toHaveProperty('error', 'Conecta tu cuenta de Mercado Pago en Settings');
  });
});

describe('createPayment - RESERVATION balance excludes PENDING and EXTRAs (issue #164)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acepta RESERVATION cuando hay un PENDING preexistente que no bloquea (PENDING no cuenta)', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    // totalPrice 100000, PENDING 80000 + nuevo RESERVATION 40000
    // Antes: totalPaid = 80000 + 40000 = 120000 > 100000 → error (incorrecto, PENDING no es dinero cobrado)
    // Después: getReservationPaidAmount = 0, newTotal = 0 + 40000 = 40000 < 100000 → acepta
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    });

    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-pending',
        reservationId: 'res-1',
        amount: 80000 as any,
        method: 'MERCADO_PAGO',
        status: 'PENDING',
        paymentType: 'RESERVATION',
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: null,
        createdAt: new Date(),
      },
    ]);

    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay-new',
      reservationId: 'res-1',
      amount: 40000 as any,
      method: 'CASH',
      status: 'COMPLETED',
      paymentType: 'RESERVATION',
      title: null,
      description: null,
      initPoint: null,
      expiresAt: null,
      paidAt: null,
      receiptUrl: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);

    const { createPayment } = await import('../payments');
    const result = await createPayment({
      reservationId: 'res-1',
      amount: 40000,
      method: 'CASH',
    });

    expect(result).toHaveProperty('success', true);
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
  });

  it('acepta RESERVATION cuando hay un EXTRA COMPLETED preexistente (EXTRAs no cuentan)', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    // totalPrice 100000, EXTRA COMPLETED 50000 + nuevo RESERVATION 80000
    // Antes: totalPaid = 50000 + 80000 = 130000 > 100000 → error (incorrecto, EXTRA no cuenta)
    // Después: getReservationPaidAmount = 0, newTotal = 0 + 80000 = 80000 < 100000 → acepta
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    });

    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-extra',
        reservationId: 'res-1',
        amount: 50000 as any,
        method: 'CASH',
        status: 'COMPLETED',
        paymentType: 'EXTRA',
        title: 'Limpieza extra',
        description: null,
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: null,
        createdAt: new Date(),
      },
    ]);

    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay-new',
      reservationId: 'res-1',
      amount: 80000 as any,
      method: 'CASH',
      status: 'COMPLETED',
      paymentType: 'RESERVATION',
      title: null,
      description: null,
      initPoint: null,
      expiresAt: null,
      paidAt: null,
      receiptUrl: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);

    const { createPayment } = await import('../payments');
    const result = await createPayment({
      reservationId: 'res-1',
      amount: 80000,
      method: 'CASH',
    });

    expect(result).toHaveProperty('success', true);
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
  });
});

describe('createPayment - CONFIRMED transition only counts RESERVATION COMPLETED (issue #164)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('NO transiciona a CONFIRMED si PENDING preexistente + nuevo COMPLETED no alcanzan totalPrice', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    // PENDING 80000 + nuevo RESERVATION 40000 COMPLETED
    // Con fix: solo cuenta COMPLETED RESERVATION = 40000 < 100000 → NO CONFIRMED
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    });

    // Primera llamada findMany: solo el PENDING
    // Segunda llamada: el PENDING + el NUEVO (COMPLETED)
    vi.mocked(prisma.payment.findMany)
      .mockResolvedValueOnce([
        {
          id: 'pay-pending',
          reservationId: 'res-1',
          amount: 80000 as any,
          method: 'MERCADO_PAGO',
          status: 'PENDING',
          paymentType: 'RESERVATION',
          initPoint: null,
          expiresAt: null,
          deletedAt: null,
          mercadoPagoId: null,
          createdAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'pay-new',
          reservationId: 'res-1',
          amount: 40000 as any,
          method: 'CASH',
          status: 'COMPLETED',
          paymentType: 'RESERVATION',
          initPoint: null,
          expiresAt: null,
          deletedAt: null,
          mercadoPagoId: null,
          createdAt: new Date(),
        },
      ]);

    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay-new',
      reservationId: 'res-1',
      amount: 40000 as any,
      method: 'CASH',
      status: 'COMPLETED',
      paymentType: 'RESERVATION',
      title: null,
      description: null,
      initPoint: null,
      expiresAt: null,
      paidAt: null,
      receiptUrl: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);

    vi.mocked(prisma.reservation.update).mockResolvedValue({} as any);

    const { createPayment } = await import('../payments');
    const result = await createPayment({
      reservationId: 'res-1',
      amount: 40000,
      method: 'CASH',
    });

    expect(result).toHaveProperty('success', true);
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it('NO transiciona a CONFIRMED si hay un EXTRA COMPLETED que iguala totalPrice + RESERVATION COMPLETED menor', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    // EXTRA COMPLETED 50000 + nuevo RESERVATION 50000 COMPLETED → total 100000
    // Con fix: solo cuenta RESERVATION COMPLETED = 50000 < 100000 → NO CONFIRMED
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    });

    vi.mocked(prisma.payment.findMany)
      .mockResolvedValueOnce([
        {
          id: 'pay-extra',
          reservationId: 'res-1',
          amount: 50000 as any,
          method: 'CASH',
          status: 'COMPLETED',
          paymentType: 'EXTRA',
          title: 'Multa',
          description: null,
          initPoint: null,
          expiresAt: null,
          deletedAt: null,
          mercadoPagoId: null,
          createdAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'pay-new',
          reservationId: 'res-1',
          amount: 50000 as any,
          method: 'CASH',
          status: 'COMPLETED',
          paymentType: 'RESERVATION',
          title: null,
          description: null,
          initPoint: null,
          expiresAt: null,
          paidAt: null,
          receiptUrl: null,
          deletedAt: null,
          mercadoPagoId: null,
          createdAt: new Date(),
        },
      ]);

    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay-new',
      reservationId: 'res-1',
      amount: 50000 as any,
      method: 'CASH',
      status: 'COMPLETED',
      paymentType: 'RESERVATION',
      title: null,
      description: null,
      initPoint: null,
      expiresAt: null,
      paidAt: null,
      receiptUrl: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);

    vi.mocked(prisma.reservation.update).mockResolvedValue({} as any);

    const { createPayment } = await import('../payments');
    const result = await createPayment({
      reservationId: 'res-1',
      amount: 50000,
      method: 'CASH',
    });

    expect(result).toHaveProperty('success', true);
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it('SÍ transiciona a CONFIRMED cuando RESERVATION COMPLETED existente + nuevo COMPLETED alcanzan totalPrice', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    // RESERVATION COMPLETED 60000 + nuevo RESERVATION 40000 COMPLETED → 100000 >= 100000 → CONFIRMED
    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    });

    vi.mocked(prisma.payment.findMany)
      .mockResolvedValueOnce([
        {
          id: 'pay-existing',
          reservationId: 'res-1',
          amount: 60000 as any,
          method: 'CASH',
          status: 'COMPLETED',
          paymentType: 'RESERVATION',
          initPoint: null,
          expiresAt: null,
          deletedAt: null,
          mercadoPagoId: null,
          createdAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'pay-existing',
          reservationId: 'res-1',
          amount: 60000 as any,
          method: 'CASH',
          status: 'COMPLETED',
          paymentType: 'RESERVATION',
          initPoint: null,
          expiresAt: null,
          deletedAt: null,
          mercadoPagoId: null,
          createdAt: new Date(),
        },
        {
          id: 'pay-new',
          reservationId: 'res-1',
          amount: 40000 as any,
          method: 'CASH',
          status: 'COMPLETED',
          paymentType: 'RESERVATION',
          title: null,
          description: null,
          initPoint: null,
          expiresAt: null,
          paidAt: null,
          receiptUrl: null,
          deletedAt: null,
          mercadoPagoId: null,
          createdAt: new Date(),
        },
      ]);

    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay-new',
      reservationId: 'res-1',
      amount: 40000 as any,
      method: 'CASH',
      status: 'COMPLETED',
      paymentType: 'RESERVATION',
      title: null,
      description: null,
      initPoint: null,
      expiresAt: null,
      paidAt: null,
      receiptUrl: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);

    vi.mocked(prisma.reservation.update).mockResolvedValue({} as any);

    const { createPayment } = await import('../payments');
    const result = await createPayment({
      reservationId: 'res-1',
      amount: 40000,
      method: 'CASH',
    });

    expect(result).toHaveProperty('success', true);
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { status: 'CONFIRMED' },
    });
  });
});

describe('generateMercadoPagoLink - pendingAmount excludes PENDING and EXTRAs (issue #164)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcula pendingAmount sin descontar PENDING preexistente', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue('fake-token');

    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    });

    // PENDING 30000 (no cobrado) — no debe afectar pendingAmount
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-pending',
        reservationId: 'res-1',
        amount: 30000 as any,
        method: 'MERCADO_PAGO',
        status: 'PENDING',
        paymentType: 'RESERVATION',
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: null,
        createdAt: new Date(),
      },
    ]);

    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay-new',
      reservationId: 'res-1',
      amount: 100000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      paymentType: 'RESERVATION',
      title: null,
      description: null,
      initPoint: null,
      expiresAt: null,
      paidAt: null,
      receiptUrl: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'mp-pref-1',
        init_point: 'https://mercadopago.com/link',
        sandbox_init_point: 'https://sandbox.mercadopago.com/link',
      }),
    });
    global.fetch = mockFetch;

    process.env.NEXT_PUBLIC_APP_URL = 'https://rentalpro.test';

    const { generateMercadoPagoLink } = await import('../payments');
    await generateMercadoPagoLink('res-1');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);

    // pendingAmount = 100000 (PENDING no descuenta), paymentAmount = 100000
    expect(body.items[0].unit_price).toBe(100000);
  });

  it('no afecta pendingAmount con EXTRAs COMPLETED', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue('fake-token');

    vi.mocked(prisma.reservation.findFirst).mockResolvedValue({
      ...mockReservation,
      totalPrice: 100000 as any,
    });

    // EXTRA COMPLETED 50000 — no debe afectar pendingAmount del arriendo
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-extra',
        reservationId: 'res-1',
        amount: 50000 as any,
        method: 'CASH',
        status: 'COMPLETED',
        paymentType: 'EXTRA',
        title: 'Limpieza',
        description: null,
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: null,
        createdAt: new Date(),
      },
    ]);

    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay-new',
      reservationId: 'res-1',
      amount: 100000 as any,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      paymentType: 'RESERVATION',
      title: null,
      description: null,
      initPoint: null,
      expiresAt: null,
      paidAt: null,
      receiptUrl: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
    } as any);

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'mp-pref-1',
        init_point: 'https://mercadopago.com/link',
        sandbox_init_point: 'https://sandbox.mercadopago.com/link',
      }),
    });
    global.fetch = mockFetch;

    process.env.NEXT_PUBLIC_APP_URL = 'https://rentalpro.test';

    const { generateMercadoPagoLink } = await import('../payments');
    await generateMercadoPagoLink('res-1');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);

    // pendingAmount = 100000 (EXTRA no descuenta), paymentAmount = 100000
    expect(body.items[0].unit_price).toBe(100000);
  });
});

describe('markPaymentAsPaid - CONFIRMED transition only counts RESERVATION COMPLETED (issue #164)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('NO transiciona a CONFIRMED si solo hay un RESERVATION PENDING que cubre totalPrice', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    // totalPrice 100000, PENDING 80000, markPaymentAsPaid de uno PENDING 30000 → COMPLETED
    // Antes: totalPaid = 80000 + 30000 = 110000 >= 100000 → CONFIRMED (incorrecto, PENDING no es cobrado)
    // Después: getReservationPaidAmount = 30000 < 100000 → NO CONFIRMED
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-to-mark',
      reservationId: 'res-1',
      amount: 30000 as any,
      method: 'CASH',
      status: 'PENDING',
      paymentType: 'RESERVATION',
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: { ...mockReservation, totalPrice: 100000 as any },
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-other',
        reservationId: 'res-1',
        amount: 80000 as any,
        method: 'MERCADO_PAGO',
        status: 'PENDING',
        paymentType: 'RESERVATION',
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: null,
        createdAt: new Date(),
      },
      {
        id: 'pay-to-mark',
        reservationId: 'res-1',
        amount: 30000 as any,
        method: 'CASH',
        status: 'PENDING', // antes del update
        paymentType: 'RESERVATION',
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: null,
        createdAt: new Date(),
      },
    ]);

    vi.mocked(prisma.reservation.update).mockResolvedValue({} as any);

    const { markPaymentAsPaid } = await import('../payments');
    const result = await markPaymentAsPaid('pay-to-mark', new Date(), 'CASH');

    expect(result).toHaveProperty('success', true);
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it('SÍ transiciona a CONFIRMED cuando RESERVATION COMPLETED alcanza totalPrice', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    // RESERVATION COMPLETED 60000 + markPaymentAsPaid de uno PENDING 40000 → COMPLETED → CONFIRMED
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay-to-mark',
      reservationId: 'res-1',
      amount: 40000 as any,
      method: 'CASH',
      status: 'PENDING',
      paymentType: 'RESERVATION',
      initPoint: null,
      expiresAt: null,
      deletedAt: null,
      mercadoPagoId: null,
      createdAt: new Date(),
      reservation: { ...mockReservation, totalPrice: 100000 as any },
    });

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);

    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay-existing',
        reservationId: 'res-1',
        amount: 60000 as any,
        method: 'CASH',
        status: 'COMPLETED',
        paymentType: 'RESERVATION',
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: null,
        createdAt: new Date(),
      },
      {
        id: 'pay-to-mark',
        reservationId: 'res-1',
        amount: 40000 as any,
        method: 'CASH',
        status: 'COMPLETED', // after the update from PENDING → COMPLETED
        paymentType: 'RESERVATION',
        initPoint: null,
        expiresAt: null,
        deletedAt: null,
        mercadoPagoId: null,
        createdAt: new Date(),
      },
    ]);

    vi.mocked(prisma.reservation.update).mockResolvedValue({} as any);

    const { markPaymentAsPaid } = await import('../payments');
    const result = await markPaymentAsPaid('pay-to-mark', new Date(), 'CASH');

    expect(result).toHaveProperty('success', true);
    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { status: 'CONFIRMED' },
    });
  });
});

describe('checkMercadoPagoPaymentStatus - uses payment owner token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses payment owner userId for token lookup (payment.reservation.userId)', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    vi.mocked(getSession).mockResolvedValue({ ...mockSession, userId: 'payment-owner' });
    vi.mocked(getMercadoPagoToken).mockResolvedValue('owner-token');

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
      createdAt: new Date(),
      reservation: { ...mockReservation, userId: 'payment-owner' },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'pending' }),
    });
    global.fetch = mockFetch;

    const { checkMercadoPagoPaymentStatus } = await import('../payments');
    await checkMercadoPagoPaymentStatus('pay-1');

    expect(getMercadoPagoToken).toHaveBeenCalledWith('payment-owner');
  });

  it('returns error when payment owner has no token', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getMercadoPagoToken } = await import('@/lib/actions/mercado-pago');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getMercadoPagoToken).mockResolvedValue(null);

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
      createdAt: new Date(),
      reservation: mockReservation,
    });

    const { checkMercadoPagoPaymentStatus } = await import('../payments');
    const result = await checkMercadoPagoPaymentStatus('pay-1');

    expect(result).toHaveProperty('error', 'Conecta tu cuenta de Mercado Pago en Settings');
  });
});
