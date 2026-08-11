import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentsSection } from '../payments-section';

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    reservation: { findFirst: vi.fn() },
    payment: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
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

vi.mock('@/lib/actions/payments', () => ({
  confirmPayment: vi.fn(),
  revertPayment: vi.fn(),
  generatePaymentLink: vi.fn(),
  markPaymentAsPaid: vi.fn(),
  attachReceipt: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/receipt-upload', () => ({
  ReceiptUpload: () => <div data-testid="receipt-upload">ReceiptUpload</div>,
}));

vi.mock('@/components/reservations/add-payment-dialog', () => ({
  AddPaymentDialog: () => <div data-testid="add-payment-dialog">AddPaymentDialog</div>,
}));

vi.mock('@/components/reservations/send-payment-link-dialog', () => ({
  SendPaymentLinkDialog: () => <div data-testid="send-payment-link-dialog">SendPaymentLinkDialog</div>,
}));

const createMockPayment = (overrides: Record<string, any> = {}): Record<string, any> => ({
  id: 'payment-1',
  installmentIndex: undefined,
  amount: '50000',
  dueDate: null,
  status: 'COMPLETED',
  method: 'MERCADO_PAGO',
  initPoint: null,
  expiresAt: null,
  paidAt: '2025-01-15T10:00:00Z',
  deletedAt: null,
  receiptUrl: null,
  paymentType: 'RESERVATION',
  title: null,
  description: null,
  ...overrides,
});

const createMockReservation = (overrides: Record<string, any> = {}) => ({
  id: 'res-1',
  propertyId: 'prop-1',
  clientId: 'client-1',
  startDate: '2025-01-01',
  endDate: '2025-01-05',
  billingType: 'DAILY',
  unitsBooked: 1,
  totalPrice: '200000',
  status: 'PENDING',
  bookingAirbnb: false,
  notes: null,
  property: { id: 'prop-1', name: 'Test Property', color: '#3B82F6', dailyPrice: '50000' },
  client: { id: 'client-1', name: 'Test Client', email: 'test@test.com' },
  payments: [],
  ...overrides,
});

describe('PaymentsSection - paymentType separation', () => {
  it('shows "Pagos de reserva" title for DAILY billing', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    expect(screen.getByText('Pagos de reserva')).toBeTruthy();
  });

  it('shows "Cuotas de arriendo" title for MONTHLY billing', () => {
    const reservation = createMockReservation({
      billingType: 'MONTHLY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    expect(screen.getByText('Cuotas de arriendo')).toBeTruthy();
  });

  it('shows "Cobros extra" section when extra payments exist', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p2', amount: '10000', status: 'COMPLETED', paymentType: 'EXTRA' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    expect(screen.getByText('Cobros extra')).toBeTruthy();
  });

  it('does not show "Cobros extra" section when no extra payments', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    expect(screen.queryByText('Cobros extra')).toBeNull();
  });

  it('shows both tables when reservation and extra payments exist', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p2', amount: '10000', status: 'COMPLETED', paymentType: 'EXTRA' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    expect(screen.getByText('Pagos de reserva')).toBeTruthy();
    expect(screen.getByText('Cobros extra')).toBeTruthy();
  });

  it('calculates paidAmount from RESERVATION COMPLETED payments only', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      totalPrice: '200000',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p2', amount: '40000', status: 'COMPLETED', paymentType: 'EXTRA' }),
        createMockPayment({ id: 'p3', amount: '30000', status: 'PENDING', paymentType: 'RESERVATION' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    // paidAmount should only count RESERVATION COMPLETED payments:
    // p1 ($50k RESERVATION COMPLETED) counts, p2 ($40k EXTRA) and p3 ($30k PENDING) don't.
    // 200000 total - 50000 paid = 150000 pending (shown in the pending KPI).
    expect(screen.getByText('$150.000')).toBeTruthy();
    expect(screen.getByText('$50.000')).toBeTruthy();
  });
});

describe('PaymentsSection - empty state', () => {
  it('muestra empty state rico en la tabla de pagos cuando payments está vacío y reserva activa', () => {
    const reservation = createMockReservation({ status: 'PENDING', payments: [] });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText('Aún no hay pagos registrados')).toBeTruthy();
    // El CTA vive SOLO dentro del empty state — el header no lo duplica
    // cuando no hay pagos (sino "Verificar" se mostraría sin tener nada que verificar).
    expect(screen.getAllByRole('button', { name: /agregar pago/i })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /verificar/i })).toBeNull();
  });

  it('muestra empty state sin CTA cuando la reserva está cancelada y sin pagos', () => {
    const reservation = createMockReservation({ status: 'CANCELLED', payments: [] });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText('Esta reserva no tiene pagos registrados.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /agregar pago/i })).toBeNull();
  });

  it('muestra empty state con CTA cuando la reserva está CONFIRMED sin pagos', () => {
    // CONFIRMED es activo (mismo tratamiento que PENDING): la reserva ya está
    // cobrada y se pueden seguir registrando pagos parciales / extras.
    const reservation = createMockReservation({ status: 'CONFIRMED', payments: [] });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText('Aún no hay pagos registrados')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /agregar pago/i })).toHaveLength(1);
  });

  it('muestra empty state sin CTA cuando la reserva está COMPLETED sin pagos', () => {
    // COMPLETED es inactivo (mismo tratamiento que CANCELLED): no se permiten
    // nuevos pagos sobre una reserva cerrada.
    const reservation = createMockReservation({ status: 'COMPLETED', payments: [] });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText('Esta reserva no tiene pagos registrados.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /agregar pago/i })).toBeNull();
  });
});
