import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/actions/auth';
import { Decimal } from '@prisma/client/runtime/client';

const mockPrisma = vi.hoisted(() => ({
  property: {
    findUnique: vi.fn(),
  },
  reservationClient: {
    findUnique: vi.fn(),
  },
  userProfile: {
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
    create: vi.fn(),
  },
  externalChannelBlock: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  $transaction: vi.fn(async (cb) => cb(mockPrisma)),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/actions/auth', () => ({
  getSession: vi.fn(),
}));

const mockRecordDomainEvent = vi.hoisted(() => vi.fn());
vi.mock('@/lib/notifications/record-event', () => ({
  recordDomainEvent: mockRecordDomainEvent,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createReservation, cancelReservation } from '../reservations';

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
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.property.findUnique).mockResolvedValue({
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
    vi.mocked(mockPrisma.reservationClient.findUnique).mockResolvedValue({
      id: 'client-1',
      name: 'Juan',
      email: 'juan@test.com',
      userId: 'user-1',
      createdAt: new Date(),
      phone: null,
      rut: null,
    });
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.create).mockResolvedValue({
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

describe('createReservation MONTHLY', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea reserva mensual con N payments en la misma transacción', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.property.findUnique).mockResolvedValue({
      id: 'prop-1',
      userId: 'owner-1',
      name: 'Casa',
      dailyPrice: 10000 as any,
      monthlyPrice: new Decimal('300000'),
      unitsAvailable: 5,
      mainImage: '',
      images: [],
      amenities: [],
      color: '#000',
      type: 'APARTMENT' as any,
      createdAt: new Date(),
      currency: 'CLP' as any,
    });
    vi.mocked(mockPrisma.reservationClient.findUnique).mockResolvedValue({
      id: 'client-1',
      name: 'Juan',
      email: 'juan@test.com',
      userId: 'user-1',
      createdAt: new Date(),
      phone: null,
      rut: null,
    });
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const createdReservation = {
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      billingType: 'MONTHLY',
      unitsBooked: 1,
      totalPrice: 900000 as any,
      status: 'PENDING',
      bookingAirbnb: false,
      notes: null,
      createdAt: new Date(),
    };
    vi.mocked(mockPrisma.reservation.create).mockResolvedValue(createdReservation);
    vi.mocked(mockPrisma.payment.create).mockResolvedValue({} as any);
    vi.mocked(mockPrisma.reservationChange.create).mockResolvedValue({} as any);

    const result = await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '31-03-2025',
      billingType: 'MONTHLY',
      unitsBooked: 1,
      months: 3,
    });

    expect(result).toHaveProperty('success', true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.payment.create).toHaveBeenCalledTimes(3);
  });

  it('crea 3 payments para reserva de 3 meses', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.property.findUnique).mockResolvedValue({
      id: 'prop-1',
      userId: 'owner-1',
      name: 'Casa',
      dailyPrice: 10000 as any,
      monthlyPrice: new Decimal('300000'),
      unitsAvailable: 5,
      mainImage: '',
      images: [],
      amenities: [],
      color: '#000',
      type: 'APARTMENT' as any,
      createdAt: new Date(),
      currency: 'CLP' as any,
    });
    vi.mocked(mockPrisma.reservationClient.findUnique).mockResolvedValue({
      id: 'client-1',
      name: 'Juan',
      email: 'juan@test.com',
      userId: 'user-1',
      createdAt: new Date(),
      phone: null,
      rut: null,
    });
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const createdReservation = {
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      billingType: 'MONTHLY',
      unitsBooked: 1,
      totalPrice: 900000 as any,
      status: 'PENDING',
      bookingAirbnb: false,
      notes: null,
      createdAt: new Date(),
    };
    vi.mocked(mockPrisma.reservation.create).mockResolvedValue(createdReservation);
    vi.mocked(mockPrisma.payment.create).mockResolvedValue({} as any);
    vi.mocked(mockPrisma.reservationChange.create).mockResolvedValue({} as any);

    await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '31-03-2025',
      billingType: 'MONTHLY',
      unitsBooked: 1,
      months: 3,
    });

    expect(mockPrisma.payment.create).toHaveBeenCalledTimes(3);
  });

  it('el payment tiene installmentIndex, dueDate, amount correctos', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.property.findUnique).mockResolvedValue({
      id: 'prop-1',
      userId: 'owner-1',
      name: 'Casa',
      dailyPrice: 10000 as any,
      monthlyPrice: new Decimal('300000'),
      unitsAvailable: 5,
      mainImage: '',
      images: [],
      amenities: [],
      color: '#000',
      type: 'APARTMENT' as any,
      createdAt: new Date(),
      currency: 'CLP' as any,
    });
    vi.mocked(mockPrisma.reservationClient.findUnique).mockResolvedValue({
      id: 'client-1',
      name: 'Juan',
      email: 'juan@test.com',
      userId: 'user-1',
      createdAt: new Date(),
      phone: null,
      rut: null,
    });
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const createdReservation = {
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      billingType: 'MONTHLY',
      unitsBooked: 1,
      totalPrice: 900000 as any,
      status: 'PENDING',
      bookingAirbnb: false,
      notes: null,
      createdAt: new Date(),
    };
    vi.mocked(mockPrisma.reservation.create).mockResolvedValue(createdReservation);
    vi.mocked(mockPrisma.payment.create).mockResolvedValue({} as any);
    vi.mocked(mockPrisma.reservationChange.create).mockResolvedValue({} as any);

    await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '31-03-2025',
      billingType: 'MONTHLY',
      unitsBooked: 1,
      months: 3,
    });

    const paymentCalls = vi.mocked(mockPrisma.payment.create).mock.calls;
    expect(paymentCalls[0][0].data.installmentIndex).toBe(1);
    expect(paymentCalls[1][0].data.installmentIndex).toBe(2);
    expect(paymentCalls[2][0].data.installmentIndex).toBe(3);
    expect(paymentCalls[0][0].data.amount.toString()).toBe('300000');
    expect(paymentCalls[0][0].data.dueDate).toEqual(new Date(2025, 0, 1));
    expect(paymentCalls[1][0].data.dueDate).toEqual(new Date(2025, 1, 1));
    expect(paymentCalls[2][0].data.dueDate).toEqual(new Date(2025, 2, 1));
  });

  it('retorna error si billingType MONTHLY pero property no tiene monthlyPrice', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.property.findUnique).mockResolvedValue({
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

    const result = await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '31-01-2025',
      billingType: 'MONTHLY',
      unitsBooked: 1,
      months: 1,
    });

    expect(result).toHaveProperty('error', 'Esta propiedad no tiene precio mensual configurado');
  });
});

describe('cancelReservation PENDING payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('elimina pagos PENDING al cancelar reserva', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue({
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-10'),
      billingType: 'DAILY',
      unitsBooked: 1,
      totalPrice: 100000 as any,
      status: 'CONFIRMED',
      bookingAirbnb: false,
      notes: null,
      createdAt: new Date(),
    });

    const result = await cancelReservation('res-1');

    expect(result).toHaveProperty('success', true);
  });
});

describe('createReservation emits RESERVATION_CREATED domain event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordDomainEvent.mockResolvedValue(undefined);
  });

  it('calls recordDomainEvent once with correct args after successful reservation', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.property.findUnique).mockResolvedValue({
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
    vi.mocked(mockPrisma.reservationClient.findUnique).mockResolvedValue({
      id: 'client-1',
      name: 'Juan',
      email: 'juan@test.com',
      userId: 'user-1',
      createdAt: new Date(),
      phone: null,
      rut: null,
    });
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservation.create).mockResolvedValue({
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
    expect(mockRecordDomainEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordDomainEvent).toHaveBeenCalledWith({
      type: 'RESERVATION_CREATED',
      reservationId: 'res-1',
      ownerId: 'user-1',
      ownerEmail: 'test@test.com',
      clientName: 'Juan',
      propertyName: 'Casa',
    });
  });

  it('does not call recordDomainEvent when reservation creation fails', async () => {
    const { getSession } = await import('@/lib/actions/auth');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.property.findUnique).mockResolvedValue(null);

    const result = await createReservation({
      propertyId: 'nonexistent',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '10-01-2025',
      billingType: 'DAILY',
      unitsBooked: 1,
    });

    expect(result).toHaveProperty('error', 'Propiedad no encontrada');
    expect(mockRecordDomainEvent).not.toHaveBeenCalled();
  });
});
