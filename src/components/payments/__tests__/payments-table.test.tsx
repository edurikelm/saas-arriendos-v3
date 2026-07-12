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

// ────────────────────────────────────────────────────────────────────────────
// receiptUrl display (variant="reservation" sin installment data)
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - receiptUrl display', () => {
  it('shows receipt button when payment has receiptUrl', () => {
    const payment = createMockPayment({
      receiptUrl: 'https://www.mercadopago.com.ar/receipts/abc123',
    });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.getByText('Monto')).toBeTruthy();
  });

  it('does not show receipt button when payment has no receiptUrl', () => {
    const payment = createMockPayment({ receiptUrl: null });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.getByText('Monto')).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// variant="reservation" — auto-detect installment columns
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - variant="reservation"', () => {
  it('muestra columnas de installment si algún pago tiene installmentIndex', () => {
    const payment = createMockPayment({ installmentIndex: 1, dueDate: '2025-02-01' });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.getByText('Cuota')).toBeTruthy();
    expect(screen.getByText('Vencimiento')).toBeTruthy();
  });

  it('oculta columnas de installment si ningún pago tiene installment data', () => {
    const payment = createMockPayment({ installmentIndex: null, installmentLabel: null });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.queryByText('Cuota')).toBeNull();
    expect(screen.queryByText('Vencimiento')).toBeNull();
  });

  it('auto-detecta installment también desde installmentLabel', () => {
    const payment = createMockPayment({
      installmentIndex: undefined,
      installmentLabel: '1 / 3',
      dueDate: '2025-02-01',
    });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.getByText('Cuota')).toBeTruthy();
  });

  it('NO muestra columnas de contexto ni de concepto', () => {
    const payment = createMockPayment({ installmentIndex: 1 });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.queryByText('Cliente')).toBeNull();
    expect(screen.queryByText('Propiedad')).toBeNull();
    expect(screen.queryByText('Concepto')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// variant="extra" — concept column, sin installment, sin context
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - variant="extra"', () => {
  it('muestra columna Concepto', () => {
    const payment = createMockPayment({ paymentType: 'EXTRA', title: 'Limpieza profunda' });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Concepto')).toBeTruthy();
  });

  it('NO muestra columnas de installment ni de contexto', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: 'Limpieza profunda',
      installmentIndex: 1,
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.queryByText('Cuota')).toBeNull();
    expect(screen.queryByText('Cliente')).toBeNull();
    expect(screen.queryByText('Propiedad')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// variant="full" — todas las columnas
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - variant="full"', () => {
  it('muestra columnas de contexto (Fecha creación, Cliente, Propiedad)', () => {
    const payment = createMockPayment();

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText('Fecha creación')).toBeTruthy();
    expect(screen.getByText('Cliente')).toBeTruthy();
    expect(screen.getByText('Propiedad')).toBeTruthy();
  });

  it('muestra columnas de installment siempre (independiente de los datos)', () => {
    const payment = createMockPayment({ installmentIndex: null, installmentLabel: null });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText('Cuota')).toBeTruthy();
    expect(screen.getByText('Vencimiento')).toBeTruthy();
  });

  it('muestra columna Concepto', () => {
    const payment = createMockPayment();

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText('Concepto')).toBeTruthy();
  });

  it('renderiza fecha de creación formateada', () => {
    const payment = createMockPayment({ createdAt: '2025-07-15T10:00:00Z' });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText('15 jul 2025')).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Concept labels y badge variants (transversal a las variants)
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - concept label', () => {
  it('muestra "Arriendo" para RESERVATION diario sin installmentIndex (variant="extra")', () => {
    const payment = createMockPayment({
      paymentType: 'RESERVATION',
      installmentIndex: null,
      installmentLabel: null,
      title: null,
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Arriendo')).toBeTruthy();
  });

  it('muestra "Mensualidad" para RESERVATION con installmentIndex (variant="full")', () => {
    const payment = createMockPayment({
      paymentType: 'RESERVATION',
      installmentIndex: 3,
      title: null,
    });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText('Mensualidad')).toBeTruthy();
    expect(screen.queryByText('Cobro extra')).toBeNull();
  });

  it('muestra el title del pago EXTRA (variant="extra")', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: 'Limpieza profunda',
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Limpieza profunda')).toBeTruthy();
  });

  it('muestra "Cobro extra" para EXTRA sin título', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: null,
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Cobro extra')).toBeTruthy();
  });
});

describe('PaymentsTable - concept badge variant', () => {
  it('badge variant=info para RESERVATION diario (variant="extra")', () => {
    const payment = createMockPayment({
      paymentType: 'RESERVATION',
      installmentIndex: null,
      title: null,
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Arriendo')).toBeTruthy();
    const badge = screen.getByText('Arriendo').closest('[class*="bg-info"]');
    expect(badge).toBeTruthy();
  });

  it('badge variant=info para RESERVATION mensual (variant="full")', () => {
    const payment = createMockPayment({
      paymentType: 'RESERVATION',
      installmentIndex: 3,
      title: null,
    });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText('Mensualidad')).toBeTruthy();
    const badge = screen.getByText('Mensualidad').closest('[class*="bg-info"]');
    expect(badge).toBeTruthy();
  });

  it('badge variant=warning para EXTRA (variant="extra")', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: 'Limpieza profunda',
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Limpieza profunda')).toBeTruthy();
    const badge = screen.getByText('Limpieza profunda').closest('[class*="bg-warning"]');
    expect(badge).toBeTruthy();
  });
});
