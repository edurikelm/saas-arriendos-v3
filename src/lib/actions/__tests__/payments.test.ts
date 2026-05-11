import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/actions/auth';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    reservation: {
      findFirst: vi.fn(),
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

    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('initPoint', 'https://mercadopago.com/new');
  });
});