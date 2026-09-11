import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    payment: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    reservation: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/actions/reservations', () => ({
  getReservations: vi.fn(),
}));

const mockSession: SessionUser = {
  userId: 'user-1',
  role: 'OWNER',
  plan: 'PRO',
  email: 'test@test.com',
};

/** Un grupo del `groupBy(["status"])`. */
const grupo = (status: string, monto: number, n: number) => ({
  status,
  _sum: { amount: monto },
  _count: { _all: n },
});

async function stubQueries(
  grupos: ReturnType<typeof grupo>[],
  vencido = { _sum: { amount: 0 }, _count: { _all: 0 } },
) {
  const { prisma } = await import('@/lib/db/prisma');
  vi.mocked(prisma.payment.groupBy).mockResolvedValue(grupos as never);
  vi.mocked(prisma.payment.aggregate).mockResolvedValue(vencido as never);
  return prisma;
}

/** El `where` con el que se llamó al `groupBy`. */
function groupByWhere(prisma: { payment: { groupBy: unknown } }) {
  const groupBy = vi.mocked(prisma.payment.groupBy as (...args: unknown[]) => unknown);
  return (groupBy.mock.calls.at(-1)?.[0] as { where?: Record<string, unknown> })?.where;
}

describe('getPaymentsKpis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna ceros cuando no hay sesión', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(null);

    const { getPaymentsKpis } = await import('../payments');

    expect(await getPaymentsKpis()).toEqual({
      cobrado: 0,
      pendiente: 0,
      pendienteCount: 0,
      vencido: 0,
      vencidoCount: 0,
      total: 0,
      totalCount: 0,
    });
  });

  it('reparte las sumas por estado y totaliza los grupos', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    await stubQueries([
      grupo('COMPLETED', 2700000, 11),
      grupo('PENDING', 250000, 1),
      grupo('FAILED', 50000, 1),
    ]);

    const { getPaymentsKpis } = await import('../payments');
    const kpis = await getPaymentsKpis();

    expect(kpis.cobrado).toBe(2700000);
    expect(kpis.pendiente).toBe(250000);
    expect(kpis.pendienteCount).toBe(1);
    // El total incluye FAILED: es la suma de lo que muestra la tabla, no un
    // subconjunto con criterio propio.
    expect(kpis.total).toBe(3000000);
    expect(kpis.totalCount).toBe(13);
  });

  it('devuelve cero en el estado que no aparece en ningún grupo', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    await stubQueries([grupo('COMPLETED', 100000, 1)]);

    const { getPaymentsKpis } = await import('../payments');
    const kpis = await getPaymentsKpis();

    expect(kpis.pendiente).toBe(0);
    expect(kpis.pendienteCount).toBe(0);
  });

  it('cuenta los cobros EXTRA, a diferencia de los helpers de queries.ts', async () => {
    // Cambio deliberado de semántica. Los helpers de `lib/payments/queries.ts`
    // fijan `paymentType: "RESERVATION"`, así que una multa cobrada no entraba
    // en "cobrado" aunque su fila apareciera en la tabla. Si las cifras
    // describen el listado, tienen que contar sus filas.
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    const prisma = await stubQueries([grupo('COMPLETED', 100000, 2)]);

    const { getPaymentsKpis } = await import('../payments');
    await getPaymentsKpis();

    expect(groupByWhere(prisma)).not.toHaveProperty('paymentType');
  });

  it('respeta el filtro de tipo cuando la vista lo pide', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    const prisma = await stubQueries([]);

    const { getPaymentsKpis } = await import('../payments');
    await getPaymentsKpis({ paymentType: 'RESERVATION' });

    expect(groupByWhere(prisma)).toMatchObject({ paymentType: 'RESERVATION' });
  });

  it('excluye los soft-deleted', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    const prisma = await stubQueries([]);

    const { getPaymentsKpis } = await import('../payments');
    await getPaymentsKpis();

    expect(groupByWhere(prisma)).toMatchObject({ deletedAt: null });
  });

  it('se ancla a las reservas del owner', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    const prisma = await stubQueries([]);

    const { getPaymentsKpis } = await import('../payments');
    await getPaymentsKpis();

    expect(groupByWhere(prisma)).toMatchObject({ reservation: { userId: 'user-1' } });
  });

  it('aplica los mismos filtros que el listado', async () => {
    // Es el punto del cambio: las cifras describen lo que muestra la tabla.
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    const prisma = await stubQueries([]);

    const { getPaymentsKpis } = await import('../payments');
    await getPaymentsKpis({ propertyId: 'prop-9', status: 'PENDING', search: 'Pedro' });

    expect(groupByWhere(prisma)).toMatchObject({
      status: 'PENDING',
      reservation: { userId: 'user-1', propertyId: 'prop-9' },
      AND: expect.any(Array),
    });
  });

  it('lo vencido son los PENDING con vencimiento anterior a hoy', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    const prisma = await stubQueries(
      [grupo('PENDING', 800000, 3)],
      { _sum: { amount: 250000 }, _count: { _all: 1 } },
    );

    const { getPaymentsKpis } = await import('../payments');
    const kpis = await getPaymentsKpis();

    expect(kpis.vencido).toBe(250000);
    expect(kpis.vencidoCount).toBe(1);

    const where = vi.mocked(prisma.payment.aggregate).mock.calls.at(-1)?.[0]?.where as {
      status?: string;
      dueDate?: { lt?: Date };
    };
    expect(where.status).toBe('PENDING');
    expect(where.dueDate?.lt).toBeInstanceOf(Date);
    // El corte es la medianoche UTC del día de hoy en la zona del negocio.
    expect(where.dueDate?.lt?.toISOString()).toMatch(/T00:00:00\.000Z$/);
  });

  it('lo vencido hereda los filtros de la vista', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    const prisma = await stubQueries([]);

    const { getPaymentsKpis } = await import('../payments');
    await getPaymentsKpis({ propertyId: 'prop-9' });

    expect(vi.mocked(prisma.payment.aggregate)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reservation: { userId: 'user-1', propertyId: 'prop-9' },
          deletedAt: null,
        }),
      }),
    );
  });
});
