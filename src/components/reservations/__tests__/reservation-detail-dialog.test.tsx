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

import { PaymentsTable } from '../reservation-detail-dialog';

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

    const btn = screen.getByRole('button', { name: /ver comprobante/i });
    expect(btn).toBeTruthy();
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

    expect(screen.queryByRole('button', { name: /ver comprobante/i })).toBeNull();
  });

  it('does not show receipt button when payment has undefined receiptUrl', () => {
    const payment = createMockPayment({
      receiptUrl: undefined,
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
      />
    );

    expect(screen.queryByRole('button', { name: /ver comprobante/i })).toBeNull();
  });

  it('shows receipt button for COMPLETED payments with receiptUrl', () => {
    const payment = createMockPayment({
      status: 'COMPLETED',
      receiptUrl: 'https://www.mercadopago.com/receipt/xyz789',
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={true}
      />
    );

    const btn = screen.getByRole('button', { name: /ver comprobante/i });
    expect(btn).toBeTruthy();
  });

  it('shows receipt button for PENDING payments with receiptUrl', () => {
    const payment = createMockPayment({
      status: 'PENDING',
      receiptUrl: 'https://www.mercadopago.com/receipt/pending123',
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
      />
    );

    const btn = screen.getByRole('button', { name: /ver comprobante/i });
    expect(btn).toBeTruthy();
  });
});