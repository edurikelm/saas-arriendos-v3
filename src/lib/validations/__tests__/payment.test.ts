import { describe, it, expect } from 'vitest';
import { paymentSchema } from '../payment';

describe('paymentSchema - receiptUrl', () => {
  it('accepts valid receiptUrl', () => {
    const result = paymentSchema.safeParse({
      reservationId: 'res-1',
      amount: 50000,
      method: 'MERCADO_PAGO',
      receiptUrl: 'https://mercadopago.com/receipt/abc123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts payment without receiptUrl', () => {
    const result = paymentSchema.safeParse({
      reservationId: 'res-1',
      amount: 50000,
      method: 'CASH',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.receiptUrl).toBeUndefined();
    }
  });

  it('rejects invalid receiptUrl', () => {
    const result = paymentSchema.safeParse({
      reservationId: 'res-1',
      amount: 50000,
      method: 'TRANSFER',
      receiptUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

describe('paymentSchema - paymentType, title, description', () => {
  it('accepts payment without paymentType (defaults to RESERVATION)', () => {
    const result = paymentSchema.safeParse({
      reservationId: 'res-1',
      amount: 50000,
      method: 'CASH',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentType).toBe('RESERVATION');
    }
  });

  it('accepts RESERVATION payment without title', () => {
    const result = paymentSchema.safeParse({
      reservationId: 'res-1',
      amount: 50000,
      method: 'CASH',
      paymentType: 'RESERVATION',
    });
    expect(result.success).toBe(true);
  });

  it('accepts EXTRA payment with title', () => {
    const result = paymentSchema.safeParse({
      reservationId: 'res-1',
      amount: 50000,
      method: 'CASH',
      paymentType: 'EXTRA',
      title: 'Limpieza',
    });
    expect(result.success).toBe(true);
  });

  it('accepts EXTRA payment with title and description', () => {
    const result = paymentSchema.safeParse({
      reservationId: 'res-1',
      amount: 50000,
      method: 'CASH',
      paymentType: 'EXTRA',
      title: 'Multa',
      description: 'Daños en la propiedad',
    });
    expect(result.success).toBe(true);
  });

  it('rejects EXTRA payment without title', () => {
    const result = paymentSchema.safeParse({
      reservationId: 'res-1',
      amount: 50000,
      method: 'CASH',
      paymentType: 'EXTRA',
    });
    expect(result.success).toBe(false);
  });
});
