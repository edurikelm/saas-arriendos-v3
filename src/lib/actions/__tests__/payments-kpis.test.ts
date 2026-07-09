import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/actions/auth';

/**
 * Cast helper para mocks de Prisma con campos extra (ej. `reservation` via include)
 * o campos faltantes (description, paymentType, title, installmentIndex, etc.).
 * El tipo generado de Prisma es estricto; los tests usan mocks parciales intencionalmente.
 */
const mockAsAny = <T>(data: T): any => data;

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    payment: {
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    reservation: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/actions/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/actions/reservations', () => ({
  getReservations: vi.fn(),
}));

vi.mock('@/lib/alerts/collection-alerts', () => ({
  classifyCollectionAlerts: vi.fn(),
}));

vi.mock('@/lib/domain/timezone', () => ({
  ...(vi.importActual('@/lib/domain/timezone') as any),
  startOfMonthInSantiago: vi.fn(() => '2025-07-01'),
}));

const mockSession: SessionUser = {
  userId: 'user-1',
  role: 'OWNER',
  plan: 'PRO',
  email: 'test@test.com',
};

describe('getPaymentsKpis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna ceros cuando no hay sesión', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(null);

    const { getPaymentsKpis } = await import('../payments');
    const result = await getPaymentsKpis();

    expect(result).toEqual({ cobradoMes: 0, pendiente: 0, pendienteCount: 0, proximos7DiasCount: 0 });
  });

  it('retorna cobradoMes solo con pagos COMPLETED del mes actual', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getReservations } = await import('@/lib/actions/reservations');
    const { classifyCollectionAlerts } = await import('@/lib/alerts/collection-alerts');

    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 150000 } } as any)
      .mockResolvedValueOnce({ _sum: { amount: 80000 } } as any);
    vi.mocked(prisma.payment.count).mockResolvedValue(3 as any);

    vi.mocked(getReservations).mockResolvedValue({ data: [], total: 0 } as any);
    vi.mocked(classifyCollectionAlerts).mockReturnValue({
      vencidos: [],
      vencenHoy: [],
      proximos7Dias: [],
    });

    const { getPaymentsKpis } = await import('../payments');
    const result = await getPaymentsKpis();

    expect(result.cobradoMes).toBe(150000);
    expect(result.pendiente).toBe(80000);
    expect(result.pendienteCount).toBe(3);
  });

  it('excluye EXTRA del cálculo de KPIs', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getReservations } = await import('@/lib/actions/reservations');
    const { classifyCollectionAlerts } = await import('@/lib/alerts/collection-alerts');

    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 0 } } as any)
      .mockResolvedValueOnce({ _sum: { amount: 0 } } as any);
    vi.mocked(prisma.payment.count).mockResolvedValue(0 as any);

    vi.mocked(getReservations).mockResolvedValue({ data: [], total: 0 } as any);
    vi.mocked(classifyCollectionAlerts).mockReturnValue({
      vencidos: [],
      vencenHoy: [],
      proximos7Dias: [],
    });

    const { getPaymentsKpis } = await import('../payments');
    const result = await getPaymentsKpis();

    // Verify both aggregate calls were made with paymentType: 'RESERVATION'
    for (const call of vi.mocked(prisma.payment.aggregate).mock.calls) {
      expect(call[0]).toMatchObject({
        where: expect.objectContaining({ paymentType: 'RESERVATION' }),
      });
    }

    expect(result.cobradoMes).toBe(0);
    expect(result.pendiente).toBe(0);
    expect(result.pendienteCount).toBe(0);
  });

  it('excluye pagos soft-deleted', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getReservations } = await import('@/lib/actions/reservations');
    const { classifyCollectionAlerts } = await import('@/lib/alerts/collection-alerts');

    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: null } } as any)
      .mockResolvedValueOnce({ _sum: { amount: null } } as any);
    vi.mocked(prisma.payment.count).mockResolvedValue(0 as any);

    vi.mocked(getReservations).mockResolvedValue({ data: [], total: 0 } as any);
    vi.mocked(classifyCollectionAlerts).mockReturnValue({
      vencidos: [],
      vencenHoy: [],
      proximos7Dias: [],
    });

    const { getPaymentsKpis } = await import('../payments');
    const result = await getPaymentsKpis();

    // Verify all calls include deletedAt: null
    for (const call of vi.mocked(prisma.payment.aggregate).mock.calls) {
      expect(call[0]).toMatchObject({
        where: expect.objectContaining({ deletedAt: null }),
      });
    }

    expect(result.cobradoMes).toBe(0);
    expect(result.pendiente).toBe(0);
    expect(result.pendienteCount).toBe(0);
  });

  it('scope por owner (no retorna pagos de otros owners)', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getReservations } = await import('@/lib/actions/reservations');
    const { classifyCollectionAlerts } = await import('@/lib/alerts/collection-alerts');

    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 50000 } } as any)
      .mockResolvedValueOnce({ _sum: { amount: 30000 } } as any);
    vi.mocked(prisma.payment.count).mockResolvedValue(2 as any);

    vi.mocked(getReservations).mockResolvedValue({ data: [], total: 0 } as any);
    vi.mocked(classifyCollectionAlerts).mockReturnValue({
      vencidos: [],
      vencenHoy: [],
      proximos7Dias: [{ paymentId: 'p1', reservationId: 'r1', clientName: 'Test', propertyName: 'Prop', dueDate: '2025-07-10', method: 'MERCADO_PAGO', amount: 10000, initPoint: null, expiresAt: null, daysFromToday: 5 } as any],
    });

    const { getPaymentsKpis } = await import('../payments');
    const result = await getPaymentsKpis();

    // Verify all calls scope by reservation.userId = session.userId
    for (const call of vi.mocked(prisma.payment.aggregate).mock.calls) {
      expect(call[0]).toMatchObject({
        where: expect.objectContaining({
          reservation: expect.objectContaining({ userId: 'user-1' }),
        }),
      });
    }

    expect(result.proximos7DiasCount).toBe(1);
    expect(result.pendienteCount).toBe(2);
  });

  it('proximos7DiasCount viene de getCollectionAlerts', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getReservations } = await import('@/lib/actions/reservations');
    const { classifyCollectionAlerts } = await import('@/lib/alerts/collection-alerts');

    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: null } } as any)
      .mockResolvedValueOnce({ _sum: { amount: null } } as any);
    vi.mocked(prisma.payment.count).mockResolvedValue(4 as any);

    vi.mocked(getReservations).mockResolvedValue({
      data: [{
        id: 'r1',
        status: 'CONFIRMED',
        client: { name: 'Client' },
        property: { name: 'Property' },
        payments: [{
          id: 'p1',
          status: 'PENDING',
          paymentType: 'RESERVATION',
          method: 'MERCADO_PAGO',
          amount: 50000,
          dueDate: '2025-07-10',
          initPoint: null,
          expiresAt: null,
        }],
      }],
      total: 1,
    } as any);

    vi.mocked(classifyCollectionAlerts).mockReturnValue({
      vencidos: [],
      vencenHoy: [],
      proximos7Dias: [
        { paymentId: 'p1', reservationId: 'r1', clientName: 'Client', propertyName: 'Property', dueDate: '2025-07-10', method: 'MERCADO_PAGO', amount: 50000, initPoint: null, expiresAt: null, daysFromToday: 5 } as any,
        { paymentId: 'p2', reservationId: 'r2', clientName: 'Client2', propertyName: 'Property2', dueDate: '2025-07-12', method: 'MERCADO_PAGO', amount: 30000, initPoint: null, expiresAt: null, daysFromToday: 7 } as any,
      ],
    });

    const { getPaymentsKpis } = await import('../payments');
    const result = await getPaymentsKpis();

    expect(result.proximos7DiasCount).toBe(2);
    expect(result.pendienteCount).toBe(4);
  });

  it('NO cuenta pagos COMPLETED fuera del mes actual en cobradoMes', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    const { prisma } = await import('@/lib/db/prisma');
    const { getReservations } = await import('@/lib/actions/reservations');
    const { classifyCollectionAlerts } = await import('@/lib/alerts/collection-alerts');

    vi.mocked(getSession).mockResolvedValue(mockSession);

    // Only the aggregate call for cobradoMes should be called with paidAt filter
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: null } } as any);
    vi.mocked(prisma.payment.count).mockResolvedValue(0 as any);

    vi.mocked(getReservations).mockResolvedValue({ data: [], total: 0 } as any);
    vi.mocked(classifyCollectionAlerts).mockReturnValue({
      vencidos: [],
      vencenHoy: [],
      proximos7Dias: [],
    });

    const { getPaymentsKpis } = await import('../payments');
    await getPaymentsKpis();

    // Verify the cobradoMes aggregate call includes paidAt >= startOfMonth
    const aggregateCalls = vi.mocked(prisma.payment.aggregate).mock.calls;
    const cobradoMesCall = aggregateCalls[0];
    expect(cobradoMesCall[0]).toMatchObject({
      where: expect.objectContaining({
        paidAt: expect.objectContaining({ gte: expect.any(Date) }),
      }),
    });
  });
});
