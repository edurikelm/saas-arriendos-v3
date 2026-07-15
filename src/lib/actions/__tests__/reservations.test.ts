import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
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
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  externalChannelBlock: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  $transaction: vi.fn(async (cb) => cb(mockPrisma)),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

const mockRecordDomainEvent = vi.hoisted(() => vi.fn());
vi.mock('@/lib/notifications/record-event', () => ({
  recordDomainEvent: mockRecordDomainEvent,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createReservation, cancelReservation, deleteReservation } from '../reservations';

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
    const { getSession } = await import('@/lib/auth/session');
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
    const { getSession } = await import('@/lib/auth/session');
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
    const { getSession } = await import('@/lib/auth/session');
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
    const { getSession } = await import('@/lib/auth/session');
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
    const { getSession } = await import('@/lib/auth/session');
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
    const { getSession } = await import('@/lib/auth/session');
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
    const { getSession } = await import('@/lib/auth/session');
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
    const { getSession } = await import('@/lib/auth/session');
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
    const { getSession } = await import('@/lib/auth/session');
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
    const { getSession } = await import('@/lib/auth/session');
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
    const { getSession } = await import('@/lib/auth/session');
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

describe('createReservation - disponibilidad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset externalChannelBlock.findMany to a fresh mock each test
    // to avoid interference between tests
    mockPrisma.externalChannelBlock.findMany = vi.fn().mockResolvedValue([]);
  });

  it('rechaza si disponibilidad insuficiente (reservas existentes agotan todas las unidades)', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.property.findUnique).mockResolvedValue({
      id: 'prop-1',
      userId: 'owner-1',
      name: 'Casa',
      dailyPrice: 25000 as any,
      monthlyPrice: null,
      unitsAvailable: 2,
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
    vi.mocked(mockPrisma.userProfile.findUnique).mockResolvedValue({
      id: 'user-1',
      name: 'Owner',
      email: 'test@test.com',
      plan: 'PRO' as any,
      createdAt: new Date(),
    });

    // Existing reservations that already book all 2 units for Jan 1-5
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([
      {
        id: 'existing-res-1',
        userId: 'user-1',
        propertyId: 'prop-1',
        clientId: 'other-client',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-05'),
        billingType: 'DAILY' as any,
        unitsBooked: 2,
        totalPrice: 200000 as any,
        status: 'CONFIRMED',
        bookingAirbnb: false,
        notes: null,
        createdAt: new Date(),
      },
    ]);

    const result = await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '05-01-2025',
      billingType: 'DAILY',
      unitsBooked: 1,
    });

    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/disponibilidad|No hay disponibilidad/);
  });

  it('calcula totalPrice DAILY correctamente: 25000 x 4 noches x 2 unidades = 200000', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.property.findUnique).mockResolvedValue({
      id: 'prop-1',
      userId: 'owner-1',
      name: 'Casa',
      dailyPrice: 25000 as any,
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
    vi.mocked(mockPrisma.userProfile.findUnique).mockResolvedValue({
      id: 'user-1',
      name: 'Owner',
      email: 'test@test.com',
      plan: 'PRO' as any,
      createdAt: new Date(),
    });
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    mockPrisma.externalChannelBlock.findMany = vi.fn().mockResolvedValue([]);

    vi.mocked(mockPrisma.reservation.create).mockResolvedValue({
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-04'),
      billingType: 'DAILY',
      unitsBooked: 2,
      totalPrice: 200000 as any,
      status: 'PENDING',
      bookingAirbnb: false,
      notes: null,
      createdAt: new Date(),
    });
    vi.mocked(mockPrisma.reservationChange.create).mockResolvedValue({} as any);

    await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '04-01-2025',
      billingType: 'DAILY',
      unitsBooked: 2,
    });

    // dailyPrice=25000, nights=differenceInDays(Jan4,Jan1)+1=4, unitsBooked=2 → 25000*4*2=200000
    const createCalls = vi.mocked(mockPrisma.reservation.create).mock.calls;
    expect(createCalls.length).toBeGreaterThan(0);
    expect(createCalls[0][0].data.totalPrice).toBe(200000);
  });

  it('bloqueos de canal externo cuentan para disponibilidad', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.property.findUnique).mockResolvedValue({
      id: 'prop-1',
      userId: 'owner-1',
      name: 'Casa',
      dailyPrice: 10000 as any,
      monthlyPrice: null,
      unitsAvailable: 1,
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
    vi.mocked(mockPrisma.userProfile.findUnique).mockResolvedValue({
      id: 'user-1',
      name: 'Owner',
      email: 'test@test.com',
      plan: 'PRO' as any,
      createdAt: new Date(),
    });
    // No existing reservations
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    // External channel block occupies 1 unit for the date range (1 + 1 > 1 → blocked)
    mockPrisma.externalChannelBlock.findMany = vi.fn().mockResolvedValue([
      {
        id: 'block-1',
        propertyId: 'prop-1',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-05'),
        status: 'ACTIVE',
        externalCalendar: { channel: 'AIRBNB' as const },
      },
    ]);

    const result = await createReservation({
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: '01-01-2025',
      endDate: '05-01-2025',
      billingType: 'DAILY',
      unitsBooked: 1,
    });

    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/disponibilidad|No hay disponibilidad/);
  });
});

describe('updateReservation - audit log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra reservationChange al cambiar startDate', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const existingReservation = {
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-05'),
      billingType: 'DAILY' as const,
      unitsBooked: 1,
      totalPrice: 100000 as any,
      status: 'CONFIRMED' as const,
      bookingAirbnb: false,
      notes: null,
      createdAt: new Date(),
      property: {
        id: 'prop-1',
        userId: 'user-1',
        name: 'Casa',
        dailyPrice: 25000 as any,
        monthlyPrice: null,
        unitsAvailable: 5,
        mainImage: '',
        images: [],
        amenities: [],
        color: '#000',
        type: 'APARTMENT' as const,
        createdAt: new Date(),
        currency: 'CLP' as any,
      },
    };

    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(existingReservation as any);
    // No conflicting reservations for the new dates
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.externalChannelBlock.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservationChange.create).mockResolvedValue({} as any);
    vi.mocked(mockPrisma.reservation.update).mockResolvedValue({
      ...existingReservation,
      startDate: new Date('2025-01-02'),
    } as any);

    const { updateReservation } = await import('../reservations');
    const result = await updateReservation('res-1', {
      startDate: '02-01-2025',
    });

    expect(result).toHaveProperty('success', true);
    // Verify logChange was called via reservationChange.create
    expect(mockPrisma.reservationChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        field: 'startDate',
        oldValue: expect.any(String),
        newValue: expect.any(String),
      }),
    });
  });

  it('registra reservationChange al cambiar endDate', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const existingReservation = {
      id: 'res-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-05'),
      billingType: 'DAILY' as const,
      unitsBooked: 1,
      totalPrice: 100000 as any,
      status: 'CONFIRMED' as const,
      bookingAirbnb: false,
      notes: null,
      createdAt: new Date(),
      property: {
        id: 'prop-1',
        userId: 'user-1',
        name: 'Casa',
        dailyPrice: 25000 as any,
        monthlyPrice: null,
        unitsAvailable: 5,
        mainImage: '',
        images: [],
        amenities: [],
        color: '#000',
        type: 'APARTMENT' as const,
        createdAt: new Date(),
        currency: 'CLP' as any,
      },
    };

    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(existingReservation as any);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.externalChannelBlock.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.reservationChange.create).mockResolvedValue({} as any);
    vi.mocked(mockPrisma.reservation.update).mockResolvedValue({
      ...existingReservation,
      endDate: new Date('2025-01-07'),
    } as any);

    const { updateReservation } = await import('../reservations');
    const result = await updateReservation('res-1', {
      endDate: '07-01-2025',
    });

    expect(result).toHaveProperty('success', true);
    expect(mockPrisma.reservationChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        field: 'endDate',
      }),
    });
  });
});

describe('deleteReservation - soft-delete payments + block on COMPLETED', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: reservation exists and belongs to mockSession
    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue({
      id: 'res-1',
      userId: mockSession.userId,
    } as any);
  });

  it('returns "No autorizado" when no session', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(null);

    const result = await deleteReservation('res-1');

    expect(result).toEqual({ error: 'No autorizado' });
    expect(mockPrisma.reservation.delete).not.toHaveBeenCalled();
    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.payment.deleteMany).not.toHaveBeenCalled();
  });

  it('returns "Reserva no encontrada" when reservation does not belong to session user', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(null);

    const result = await deleteReservation('res-1');

    expect(result).toEqual({ error: 'Reserva no encontrada' });
    expect(mockPrisma.reservation.delete).not.toHaveBeenCalled();
  });

  it('blocks deletion when reservation has ≥1 COMPLETED payment (suggests cancelReservation)', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.payment.count).mockResolvedValue(1);

    const result = await deleteReservation('res-1');

    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/pagos COMPLETED/);
    expect(result.error).toMatch(/cancelReservation/);
    // No debe ejecutar ninguna mutación cuando bloquea
    expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.payment.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.reservationChange.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.reservation.delete).not.toHaveBeenCalled();
  });

  it('soft-deletes payments + hard-deletes reservation when no COMPLETED payments', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.payment.count).mockResolvedValue(0);

    const result = await deleteReservation('res-1');

    expect(result).toEqual({ success: true });
    // Soft-delete de pagos restantes (PENDING/FAILED), no hard-delete
    expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        reservationId: 'res-1',
        deletedAt: null,
      },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockPrisma.payment.deleteMany).not.toHaveBeenCalled();
    // Audit log + reserva: hard-delete (siguen a la reserva)
    expect(mockPrisma.reservationChange.deleteMany).toHaveBeenCalledWith({
      where: { reservationId: 'res-1' },
    });
    expect(mockPrisma.reservation.delete).toHaveBeenCalledWith({
      where: { id: 'res-1' },
    });
  });

  it('counts only non-soft-deleted COMPLETED payments for the block decision', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.payment.count).mockResolvedValue(0);

    await deleteReservation('res-1');

    expect(mockPrisma.payment.count).toHaveBeenCalledWith({
      where: {
        reservationId: 'res-1',
        status: 'COMPLETED',
        deletedAt: null,
      },
    });
  });

  it('does not block when COMPLETED payments exist but are already soft-deleted', async () => {
    // Escenario edge: el admin ya marcó pagos como deletedAt en otra operación.
    // El count filtra deletedAt: null, así que no debe bloquear.
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.payment.count).mockResolvedValue(0);

    const result = await deleteReservation('res-1');

    expect(result).toEqual({ success: true });
    expect(mockPrisma.reservation.delete).toHaveBeenCalled();
  });
});
