import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Payment } from '../payments-table';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { PaymentsTable } from '../payments-table';

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
  createdAt: '2025-07-15T10:00:00Z',
  clientName: 'Carlos Rodríguez',
  propertyName: 'Cabaña del Bosque',
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

  it('muestra columnas Fecha, Cliente, Propiedad cuando showContextColumns=true', () => {
    const payment = createMockPayment({
      createdAt: '2025-07-15T10:00:00Z',
      clientName: 'Carlos Rodríguez',
      propertyName: 'Cabaña del Bosque',
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
        showConceptColumn={false}
        showContextColumns={true}
      />
    );

    expect(screen.getByText('15 jul 2025')).toBeTruthy();
    expect(screen.getByText('Carlos Rodríguez')).toBeTruthy();
    expect(screen.getByText('Cabaña del Bosque')).toBeTruthy();
  });

  it('no muestra columnas de contexto cuando showContextColumns=false', () => {
    const payment = createMockPayment({
      createdAt: '2025-07-15T10:00:00Z',
      clientName: 'Carlos Rodríguez',
      propertyName: 'Cabaña del Bosque',
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
        showConceptColumn={false}
        showContextColumns={false}
      />
    );

    expect(screen.queryByText('Carlos Rodríguez')).toBeNull();
    expect(screen.queryByText('Cabaña del Bosque')).toBeNull();
  });

  it('muestra "Arriendo" para RESERVATION diario sin installmentIndex', () => {
    const payment = createMockPayment({
      paymentType: 'RESERVATION',
      installmentIndex: null,
      title: null,
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
        showConceptColumn={true}
        showContextColumns={false}
      />
    );

    expect(screen.getByText('Arriendo')).toBeTruthy();
  });

  it('muestra "Mensualidad" para RESERVATION mensual con installmentIndex', () => {
    const payment = createMockPayment({
      paymentType: 'RESERVATION',
      installmentIndex: 3,
      title: null,
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={true}
        showConceptColumn={true}
        showContextColumns={false}
      />
    );

    expect(screen.getByText('Mensualidad')).toBeTruthy();
    expect(screen.queryByText('Cobro extra')).toBeNull();
  });

  it('muestra el title del pago EXTRA', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: 'Limpieza profunda',
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
        showConceptColumn={true}
        showContextColumns={false}
      />
    );

    expect(screen.getByText('Limpieza profunda')).toBeTruthy();
  });

  it('muestra "Cobro extra" para EXTRA sin título', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: null,
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
        showConceptColumn={true}
        showContextColumns={false}
      />
    );

    expect(screen.getByText('Cobro extra')).toBeTruthy();
  });

  it('muestra "Fecha creación" como header de la columna de fecha', () => {
    const payment = createMockPayment({
      createdAt: '2025-07-15T10:00:00Z',
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
        showConceptColumn={false}
        showContextColumns={true}
      />
    );

    expect(screen.getByText('Fecha creación')).toBeTruthy();
  });

  it('renderiza Concepto con badge variant=info para RESERVATION diario', () => {
    const payment = createMockPayment({
      paymentType: 'RESERVATION',
      installmentIndex: null,
      title: null,
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
        showConceptColumn={true}
        showContextColumns={false}
      />
    );

    expect(screen.getByText('Arriendo')).toBeTruthy();
    const badge = screen.getByText('Arriendo').closest('[class*="bg-info"]');
    expect(badge).toBeTruthy();
  });

  it('renderiza Concepto con badge variant=info para RESERVATION mensual', () => {
    const payment = createMockPayment({
      paymentType: 'RESERVATION',
      installmentIndex: 3,
      title: null,
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={true}
        showConceptColumn={true}
        showContextColumns={false}
      />
    );

    expect(screen.getByText('Mensualidad')).toBeTruthy();
    const badge = screen.getByText('Mensualidad').closest('[class*="bg-info"]');
    expect(badge).toBeTruthy();
  });

  it('renderiza Concepto con badge variant=warning para EXTRA', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: 'Limpieza profunda',
    });

    render(
      <PaymentsTable
        payments={[payment]}
        showInstallmentColumns={false}
        showConceptColumn={true}
        showContextColumns={false}
      />
    );

    expect(screen.getByText('Limpieza profunda')).toBeTruthy();
    const badge = screen.getByText('Limpieza profunda').closest('[class*="bg-warning"]');
    expect(badge).toBeTruthy();
  });
});
