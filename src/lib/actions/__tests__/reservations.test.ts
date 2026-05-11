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
    },
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
    vi.mocked(prisma.reservation.create).mockResolvedValue({
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-10'),
      billingType: 'DAILY',
      unitsBooked: 1,
      totalPrice: 90000 as any,
      status: 'PENDING',
      bookingAirbnb: false,
      notes: null,
      createdAt: new Date(),
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
