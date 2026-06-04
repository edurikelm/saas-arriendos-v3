import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/actions/auth';

const mockPrisma = vi.hoisted(() => ({
  reservation: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/actions/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { getReservations } from '../reservations';

const mockSession: SessionUser = {
  userId: 'user-1',
  role: 'OWNER',
  plan: 'PRO',
  email: 'test@test.com',
};

const makeReservation = (id: string, overrides: Record<string, unknown> = {}) => {
  const d = new Date('2025-01-01');
  return {
    id,
    userId: 'user-1',
    propertyId: 'prop-1',
    clientId: 'client-1',
    startDate: d,
    endDate: d,
    billingType: 'DAILY',
    unitsBooked: 1,
    totalPrice: { toString: () => '10000' } as any,
    status: 'PENDING',
    bookingAirbnb: false,
    notes: null,
    createdAt: d,
    property: {
      id: 'prop-1',
      name: 'Casa Test',
      color: '#000',
      dailyPrice: { toString: () => '10000' } as any,
      monthlyPrice: null,
      unitsAvailable: 5,
    },
    client: {
      id: 'client-1',
      name: 'Juan Perez',
      email: 'juan@test.com',
      phone: '123456',
    },
    payments: [],
    ...overrides,
  };
};

describe('getReservations pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated response with defaults page=1, limit=10', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(0);

    const result = await getReservations();
    expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
    expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 })
    );
  });

  it('calculates skip correctly for page 2 with limit 20', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(0);

    await getReservations({ page: 2, limit: 20 });
    expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 })
    );
  });

  it('calculates skip for page 3 with limit 10', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(0);

    await getReservations({ page: 3, limit: 10 });
    expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it('computes totalPages correctly for 50 items with limit 20', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([makeReservation('1')]);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(50);

    const result = await getReservations({ page: 1, limit: 20 });
    expect(result.totalPages).toBe(3);
    expect(result.total).toBe(50);
    expect(result.page).toBe(1);
  });

  it('computes totalPages for exact division', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(40);

    const result = await getReservations({ limit: 20 });
    expect(result.totalPages).toBe(2);
  });

  it('computes totalPages for less than one page', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(15);

    const result = await getReservations({ limit: 20 });
    expect(result.totalPages).toBe(1);
  });

  it('adds search OR conditions to where clause', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(0);

    await getReservations({ search: 'casa' });
    expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { client: { name: { contains: 'casa', mode: 'insensitive' } } },
            { property: { name: { contains: 'casa', mode: 'insensitive' } } },
          ],
        }),
      })
    );
  });

  it('merges search OR with other filters via AND', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(0);

    await getReservations({
      search: 'casa',
      status: 'PENDING',
      billingType: 'DAILY',
    });

    expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PENDING',
          billingType: 'DAILY',
          OR: [
            { client: { name: { contains: 'casa', mode: 'insensitive' } } },
            { property: { name: { contains: 'casa', mode: 'insensitive' } } },
          ],
        }),
      })
    );
  });

  it('passes billingType filter to where clause', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(0);

    await getReservations({ billingType: 'MONTHLY' });
    expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ billingType: 'MONTHLY' }),
      })
    );
  });

  it('runs findMany and count in parallel', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    let findManyCalled = false;
    let countCalled = false;

    vi.mocked(mockPrisma.reservation.findMany).mockImplementation(async () => {
      findManyCalled = true;
      return [];
    });
    vi.mocked(mockPrisma.reservation.count).mockImplementation(async () => {
      countCalled = true;
      return 0;
    });

    await getReservations();

    expect(findManyCalled).toBe(true);
    expect(countCalled).toBe(true);
  });

  it('returns empty paginated result when session is null', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(null);

    const result = await getReservations();
    expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
  });
});
