import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/actions/auth';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    property: {
      findUnique: vi.fn(),
    },
    reservation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    reservationChange: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    payment: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/actions/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createReservation } from '../reservations';

const mockSession: SessionUser = {
  userId: 'user-1',
  role: 'OWNER',
  plan: 'PRO',
  email: 'test@test.com',
};

describe('createReservation - action owns validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing propertyId', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const result = await createReservation({
      propertyId: '',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '10-01-2025',
      billingType: 'DAILY',
      unitsBooked: 1,
    });

    expect(result).toHaveProperty('error');
  });

  it('rejects invalid date format', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const result = await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: 'not-a-date',
      endDate: '01-01-2025',
      billingType: 'DAILY',
      unitsBooked: 1,
    });

    expect(result).toHaveProperty('error');
  });

  it('rejects unitsBooked less than 1', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const result = await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '10-01-2025',
      billingType: 'DAILY',
      unitsBooked: 0,
    });

    expect(result).toHaveProperty('error');
  });

  it('accepts valid data when property exists and has availability', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { getSession } = await import('@/lib/actions/auth');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      id: 'prop-1',
      userId: 'owner-1',
      name: 'Casa',
      dailyPrice: 10000 as any,
      monthlyPrice: null,
      unitsAvailable: 5,
      mainImage: '',
      images: [],
      amenities: [],
      color: '#000',
      type: 'APARTMENT' as any,
      createdAt: new Date(),
      currency: 'CLP' as any,
    });
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
      const mockTx: any = {
        reservation: { create: vi.fn().mockResolvedValue({ id: 'res-1' }) },
        reservationChange: { create: vi.fn() },
      };
      return cb(mockTx);
    });

    const result = await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '10-01-2025',
      billingType: 'DAILY',
      unitsBooked: 1,
    });

    expect(result).toHaveProperty('success', true);
  });
});

describe('createReservation MONTHLY billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates N payments when billingType is MONTHLY with 3 months', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { getSession } = await import('@/lib/actions/auth');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      id: 'prop-1',
      userId: 'owner-1',
      name: 'Casa',
      dailyPrice: 30000 as any,
      monthlyPrice: 300000 as any,
      unitsAvailable: 5,
      mainImage: '',
      images: [],
      amenities: [],
      color: '#000',
      type: 'APARTMENT' as any,
      createdAt: new Date(),
      currency: 'CLP' as any,
    });
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);

    let createdPayments: any[] = [];
    vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
      const mockTx: any = {
        reservation: { create: vi.fn().mockResolvedValue({ id: 'res-1' }) },
        reservationChange: { create: vi.fn() },
        payment: { createMany: vi.fn((opts: any) => { createdPayments = opts.data; }) },
      };
      return cb(mockTx);
    });

    const result = await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '15-01-2025',
      endDate: '14-04-2025',
      billingType: 'MONTHLY',
      unitsBooked: 1,
      months: 3,
    });

    expect(result).toHaveProperty('success', true);
    expect(createdPayments).toHaveLength(3);
    expect(createdPayments[0]).toMatchObject({
      monthNumber: 1,
      totalMonths: 3,
      status: 'PENDING',
      method: 'CASH',
    });
    expect(createdPayments[1]).toMatchObject({ monthNumber: 2, totalMonths: 3 });
    expect(createdPayments[2]).toMatchObject({ monthNumber: 3, totalMonths: 3 });
  });

  it('sets expiresAt to last day of each month', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    const { getSession } = await import('@/lib/actions/auth');

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      id: 'prop-1',
      userId: 'owner-1',
      name: 'Casa',
      dailyPrice: 30000 as any,
      monthlyPrice: 300000 as any,
      unitsAvailable: 5,
      mainImage: '',
      images: [],
      amenities: [],
      color: '#000',
      type: 'APARTMENT' as any,
      createdAt: new Date(),
      currency: 'CLP' as any,
    });
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);

    let createdPayments: any[] = [];
    vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
      const mockTx: any = {
        reservation: { create: vi.fn().mockResolvedValue({ id: 'res-1' }) },
        reservationChange: { create: vi.fn() },
        payment: { createMany: vi.fn((opts: any) => { createdPayments = opts.data; }) },
      };
      return cb(mockTx);
    });

    await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '15-01-2025',
      endDate: '14-04-2025',
      billingType: 'MONTHLY',
      unitsBooked: 1,
      months: 3,
    });

    expect(createdPayments[0].expiresAt.getMonth()).toBe(0);
    expect(createdPayments[1].expiresAt.getMonth()).toBe(1);
    expect(createdPayments[2].expiresAt.getMonth()).toBe(2);
  });

  it('rejects MONTHLY reservation without months field', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const result = await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '15-01-2025',
      endDate: '14-04-2025',
      billingType: 'MONTHLY',
      unitsBooked: 1,
    });

    expect(result).toHaveProperty('error');
  });
});
