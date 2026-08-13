import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
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
    // "Agregar Pago" aparece en el header + empty state (2×). "Verificar" no aparece
    // cuando no hay pagos (nada que verificar).
    expect(screen.getAllByRole('button', { name: /agregar pago/i })).toHaveLength(2);
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
    // "Agregar Pago" aparece en el header + empty state (2×).
    expect(screen.getAllByRole('button', { name: /agregar pago/i })).toHaveLength(2);
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

describe('PaymentsSection - status filter', () => {
  it('muestra 3 filter pills: Todos, Pendientes, Pagados', () => {
    const reservation = createMockReservation({
      status: 'CONFIRMED',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'PENDING', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p2', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
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

    expect(screen.getByRole('button', { name: /^todos$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^pendientes$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^pagados$/i })).toBeTruthy();
  });

  it('muestra solo pagos pendientes cuando se filtra por "Pendientes"', async () => {
    const reservation = createMockReservation({
      status: 'CONFIRMED',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'PENDING', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p2', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p3', amount: '50000', status: 'PENDING', paymentType: 'RESERVATION' }),
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

    // Click "Pendientes" wrapped in act() for state update
    const pendientesBtn = screen.getByRole('button', { name: /^pendientes$/i });
    await act(async () => {
      pendientesBtn.click();
    });

    // Count rows within the reservation table (first table, identified by caption)
    const table = screen.getByRole('table', { name: /listado de pagos/i });
    const { getAllByRole } = within(table);
    const rows = getAllByRole('row');
    // First row is thead, remaining are tbody data rows
    const dataRows = rows.slice(1);
    expect(dataRows.length).toBe(2);
  });

  it('muestra todos los pagos cuando se filtra por "Todos" (default)', () => {
    const reservation = createMockReservation({
      status: 'CONFIRMED',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'PENDING', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p2', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p3', amount: '50000', status: 'FAILED', paymentType: 'RESERVATION' }),
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

    // Default filter is "Todos" — all 3 payments visible
    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });
});

describe('PaymentsSection - overdue KPI', () => {
  it('muestra KPI "Vencido" cuando hay pagos pendientes con dueDate pasada', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const reservation = createMockReservation({
      status: 'PENDING',
      payments: [
        createMockPayment({
          id: 'p1',
          amount: '50000',
          status: 'PENDING',
          paymentType: 'RESERVATION',
          dueDate: yesterday.toISOString(),
        }),
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

    // El KPI Vencido es un group con aria-label="Vencido"; buscamos el span de valor
    // dentro de ese group para ser específicos y no chocar con la tabla de pagos.
    const vencidoCard = screen.getByRole('group', { name: 'Vencido' });
    expect(vencidoCard).toBeTruthy();
    expect(within(vencidoCard).getByText('$50.000')).toBeTruthy();
  });

  it('muestra $0 en KPI Vencido cuando no hay pagos vencidos', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const reservation = createMockReservation({
      status: 'PENDING',
      payments: [
        createMockPayment({
          id: 'p1',
          amount: '50000',
          status: 'PENDING',
          paymentType: 'RESERVATION',
          dueDate: tomorrow.toISOString(),
        }),
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

    // Vencido muestra $0 cuando no hay pagos vencidos
    const vencidoCard = screen.getByRole('group', { name: 'Vencido' });
    expect(within(vencidoCard).getByText('$0')).toBeTruthy();
  });

  it('no cuenta como vencido un pago con dueDate null', () => {
    const reservation = createMockReservation({
      status: 'PENDING',
      payments: [
        createMockPayment({
          id: 'p1',
          amount: '50000',
          status: 'PENDING',
          paymentType: 'RESERVATION',
          dueDate: null,
        }),
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

    // Sin dueDate no hay forma de saber si está vencido → KPI debe ser $0
    const vencidoCard = screen.getByRole('group', { name: 'Vencido' });
    expect(within(vencidoCard).getByText('$0')).toBeTruthy();
  });

  it('no cuenta como vencido un pago EXTRA con dueDate pasada', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const reservation = createMockReservation({
      status: 'PENDING',
      payments: [
        createMockPayment({
          id: 'p1',
          amount: '50000',
          status: 'PENDING',
          paymentType: 'EXTRA',
          title: 'Limpieza',
          dueDate: yesterday.toISOString(),
        }),
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

    // Los EXTRAs no cuentan para el saldo del arriendo → KPI Vencido = $0
    const vencidoCard = screen.getByRole('group', { name: 'Vencido' });
    expect(within(vencidoCard).getByText('$0')).toBeTruthy();
  });

  it('no cuenta como vencido un pago soft-deleted', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const reservation = createMockReservation({
      status: 'PENDING',
      payments: [
        createMockPayment({
          id: 'p1',
          amount: '50000',
          status: 'PENDING',
          paymentType: 'RESERVATION',
          dueDate: yesterday.toISOString(),
          deletedAt: '2025-01-01T00:00:00.000Z',
        }),
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

    // Soft-deleted se excluye (auditoría) → KPI Vencido = $0
    const vencidoCard = screen.getByRole('group', { name: 'Vencido' });
    expect(within(vencidoCard).getByText('$0')).toBeTruthy();
  });
});
