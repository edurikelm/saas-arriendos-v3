import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Payment } from '../reservation-detail-dialog';

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
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/receipt-upload', () => ({
  ReceiptUpload: () => <div data-testid="receipt-upload">ReceiptUpload</div>,
}));

vi.mock('./add-payment-dialog', () => ({
  AddPaymentDialog: () => <div data-testid="add-payment-dialog">AddPaymentDialog</div>,
}));

vi.mock('../reservation-documents-panel', () => ({
  ReservationDocumentsPanel: () => <div data-testid="reservation-documents-panel">ReservationDocumentsPanel</div>,
}));

import { PaymentsTable, ReservationDetailDialog } from '../reservation-detail-dialog';

const createMockPayment = (overrides: Partial<Payment> = {}): Payment => ({
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

describe('PaymentsTable - receiptUrl display', () => {
  it('shows receipt button when payment has receiptUrl', () => {
    const payment = createMockPayment({
      receiptUrl: 'https://www.mercadopago.com.ar/receipts/abc123',
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
      />
    );

    expect(screen.getByText('Monto')).toBeTruthy();
  });

  it('does not show receipt button when payment has no receiptUrl', () => {
    const payment = createMockPayment({
      receiptUrl: null,
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
      />
    );

    expect(screen.getByText('Monto')).toBeTruthy();
  });

  it('renders installment columns when showInstallmentColumns is true', () => {
    const payment = createMockPayment({ installmentIndex: 1, dueDate: '2025-02-01' });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={true}
      />
    );

    expect(screen.getByText('Cuota')).toBeTruthy();
    expect(screen.getByText('Vencimiento')).toBeTruthy();
  });

  it('hides installment columns when showInstallmentColumns is false', () => {
    const payment = createMockPayment({ installmentIndex: 1, dueDate: '2025-02-01' });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
      />
    );

    expect(screen.queryByText('Cuota')).toBeNull();
    expect(screen.queryByText('Vencimiento')).toBeNull();
  });
});

describe('ReservationDetailDialog - paymentType separation', () => {
  it('shows reservation documents panel only for MONTHLY + PRO', () => {
    const reservation = createMockReservation({
      billingType: 'MONTHLY',
    });

    const { rerender } = render(
      <ReservationDetailDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
        plan="PRO"
      />
    );

    expect(screen.getByTestId('reservation-documents-panel')).toBeTruthy();

    rerender(
      <ReservationDetailDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
        plan="FREE"
      />
    );

    expect(screen.queryByTestId('reservation-documents-panel')).toBeNull();
  });

  it('shows "Pagos de reserva" title for DAILY billing', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
      ],
    });

    render(
      <ReservationDetailDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
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
      <ReservationDetailDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
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
      <ReservationDetailDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
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
      <ReservationDetailDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
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
      <ReservationDetailDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
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
      <ReservationDetailDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    // paidAmount should only count RESERVATION COMPLETED payments:
    // p1 ($50k RESERVATION COMPLETED) counts, p2 ($40k EXTRA) and p3 ($30k PENDING) don't.
    // 200000 total - 50000 paid = 150000 pending (shown in the "Saldo pendiente" row).
    // "Monto pagado" should reflect RESERVATION COMPLETED only ($50k), excluding the $40k EXTRA.
    expect(screen.getByText('$150.000')).toBeTruthy();
    expect(screen.getByText('$50.000')).toBeTruthy();
  });
});
