import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { Decimal } from '@prisma/client/runtime/client';
import { getReservationById } from '../reservations';

const mockPrisma = vi.hoisted(() => ({
  reservation: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

const mockSession: SessionUser = {
  userId: 'user-1',
  role: 'OWNER',
  plan: 'PRO',
  email: 'test@test.com',
};

function buildMockReservation(overrides: Partial<{
  payments: Array<{ id: string; deletedAt: Date | null }>;
  changes: Array<{ id: string; createdAt: Date }>;
}> = {}) {
  const now = new Date();
  return {
    id: 'res-1',
    userId: 'user-1',
    propertyId: 'prop-1',
    clientId: 'client-1',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-10'),
    billingType: 'DAILY' as const,
    unitsBooked: 1,
    totalPrice: new Decimal(100000),
    status: 'PENDING' as const,
    bookingAirbnb: false,
    notes: null,
    createdAt: now,
    property: {
      id: 'prop-1',
      name: 'Casa',
      type: 'HOUSE' as const,
      color: '#000000',
      dailyPrice: new Decimal(50000),
      monthlyPrice: null,
      unitsAvailable: 5,
      amenities: [],
      mainImage: null,
      images: [],
      userId: 'user-1',
      createdAt: now,
    },
    client: {
      id: 'client-1',
      name: 'Juan',
      email: 'juan@test.com',
      phone: '+1234567890',
      rut: '12345678-9',
      notes: null,
      userId: 'user-1',
      createdAt: now,
    },
    payments: overrides.payments ?? [
      {
        id: 'pay-1',
        reservationId: 'res-1',
        paymentType: 'RENT' as const,
        title: 'Renta enero',
        description: null,
        amount: new Decimal(100000),
        status: 'PENDING' as const,
        method: 'TRANSFER' as const,
        initPoint: null,
        expiresAt: null,
        installmentIndex: 1,
        dueDate: new Date('2025-01-01'),
        paidAt: null,
        receiptUrl: null,
        mercadoPagoId: null,
        deletedAt: null,
      },
    ],
    changes: overrides.changes ?? [
      {
        id: 'change-1',
        reservationId: 'res-1',
        field: 'status',
        oldValue: 'PENDING',
        newValue: 'CONFIRMED',
        createdAt: now,
      },
    ],
  };
}

describe('getReservationById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Sin sesión → retorna null', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(null);

    const result = await getReservationById('res-1');

    expect(result).toBeNull();
  });

  it('filtra por userId e id en el where de findFirst', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.reservation.findFirst.mockResolvedValue(buildMockReservation());

    await getReservationById('res-1');

    expect(mockPrisma.reservation.findFirst).toHaveBeenCalledTimes(1);
    const callArgs = mockPrisma.reservation.findFirst.mock.calls[0][0];
    expect(callArgs.where).toEqual({ id: 'res-1', userId: 'user-1' });
  });

  it('payments incluye where deletedAt: null en la query de Prisma', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.reservation.findFirst.mockResolvedValue(buildMockReservation());

    await getReservationById('res-1');

    const callArgs = mockPrisma.reservation.findFirst.mock.calls[0][0];
    expect(callArgs.include.payments).toEqual({ where: { deletedAt: null } });
  });

  it('changes tiene take: 50 y orderBy createdAt desc', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.reservation.findFirst.mockResolvedValue(buildMockReservation());

    await getReservationById('res-1');

    const callArgs = mockPrisma.reservation.findFirst.mock.calls[0][0];
    expect(callArgs.include.changes).toEqual({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('mapea correctamente property, client, payments y changes en el response', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    const now = new Date();
    const mockRes = buildMockReservation({
      payments: [
        {
          id: 'pay-1',
          deletedAt: null,
        },
      ],
      changes: [
        {
          id: 'change-1',
          createdAt: now,
        },
      ],
    });
    mockPrisma.reservation.findFirst.mockResolvedValue(mockRes);

    const result = await getReservationById('res-1');

    expect(result).not.toBeNull();
    expect(result!.property).toEqual({
      id: 'prop-1',
      name: 'Casa',
      type: 'HOUSE',
      color: '#000000',
      dailyPrice: '50000',
      monthlyPrice: null,
      unitsAvailable: 5,
      amenities: [],
      mainImage: null,
      images: [],
      userId: 'user-1',
      createdAt: now.toISOString(),
    });
    expect(result!.client).toEqual({
      id: 'client-1',
      name: 'Juan',
      email: 'juan@test.com',
      phone: '+1234567890',
      rut: '12345678-9',
      notes: null,
      userId: 'user-1',
      createdAt: now.toISOString(),
    });
    expect(result!.payments).toHaveLength(1);
    expect(result!.payments[0].id).toBe('pay-1');
    expect(result!.payments[0].deletedAt).toBeNull();
    expect(result!.changes).toHaveLength(1);
    expect(result!.changes[0].id).toBe('change-1');
  });

  it('payments con deletedAt no aparecen en el response', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    const now = new Date();
    // Simula que Prisma con where: { deletedAt: null } retorna solo el pago activo.
    // El código ya no hace .filter() en JS — la base de datos filtra.
    mockPrisma.reservation.findFirst.mockResolvedValue({
      ...buildMockReservation(),
      payments: [
        {
          id: 'pay-active',
          reservationId: 'res-1',
          paymentType: 'RENT' as const,
          title: 'Renta enero',
          description: null,
          amount: new Decimal(100000),
          status: 'PENDING' as const,
          method: 'TRANSFER' as const,
          initPoint: null,
          expiresAt: null,
          installmentIndex: 1,
          dueDate: new Date('2025-01-01'),
          paidAt: null,
          receiptUrl: null,
          mercadoPagoId: null,
          deletedAt: null,
        },
      ],
      changes: [],
    });

    const result = await getReservationById('res-1');

    // Verificar que el where con deletedAt: null se pasa a Prisma
    const callArgs = mockPrisma.reservation.findFirst.mock.calls[0][0];
    expect(callArgs.include.payments).toEqual({ where: { deletedAt: null } });
    // Y que solo el pago activo (sin deletedAt) aparece en el response
    expect(result!.payments).toHaveLength(1);
    expect(result!.payments[0].id).toBe('pay-active');
  });

  it('changes respeta orden DESC y take: solo los 50 más recientes aparecen', async () => {
    const { getSession } = await import('@/lib/auth/session');
    vi.mocked(getSession).mockResolvedValue(mockSession);
    const now = new Date();
    // Generar 60 cambios; Prisma con take:50 retorna solo los primeros 50 (más recientes).
    const sixtyChanges = Array.from({ length: 60 }, (_, i) => ({
      id: `change-${i}`,
      reservationId: 'res-1',
      field: 'status',
      oldValue: `old-${i}`,
      newValue: `new-${i}`,
      createdAt: new Date(now.getTime() - i * 1000), // más antiguo = mayor índice
    }));
    // El mock retorna los 60 tal cual, pero Prisma con take:50 solo retornaría 50.
    // Simulamos el resultado que Prisma retornaría después de apply take:50.
    mockPrisma.reservation.findFirst.mockResolvedValue({
      ...buildMockReservation(),
      changes: sixtyChanges.slice(0, 50), // solo los 50 más recientes
    });

    const result = await getReservationById('res-1');

    // Verificar que el take:50 se pasa a Prisma
    const callArgs = mockPrisma.reservation.findFirst.mock.calls[0][0];
    expect(callArgs.include.changes).toEqual({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    // Verificar que solo 50 cambios aparecen (los más recientes)
    expect(result!.changes).toHaveLength(50);
    expect(result!.changes[0].id).toBe('change-0'); // más reciente
    expect(result!.changes[49].id).toBe('change-49'); // 50° más reciente
  });
});
