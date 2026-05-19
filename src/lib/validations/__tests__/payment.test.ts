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
