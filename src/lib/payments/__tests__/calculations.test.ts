import { describe, it, expect } from 'vitest';
import { getReservationPaidAmount, getReservationPendingAmount } from '../calculations';

describe('getReservationPaidAmount', () => {
  // Prioridad 1 — cubren el bug
  it('EXTRAS no cuentan en getReservationPaidAmount', () => {
    const payments = [
      { amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' },
      { amount: '40000', status: 'COMPLETED', paymentType: 'EXTRA' },
      { amount: '30000', status: 'PENDING', paymentType: 'RESERVATION' },
    ];
    expect(getReservationPaidAmount(payments)).toBe(50000);
  });

  it('soft-deleted no cuenta', () => {
    const payments = [
      { amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' },
      { amount: '99999', status: 'COMPLETED', paymentType: 'RESERVATION', deletedAt: '2025-01-01' },
    ];
    expect(getReservationPaidAmount(payments)).toBe(50000);
  });

  it('paymentType undefined cuenta como RESERVATION', () => {
    const payments = [{ amount: '50000', status: 'COMPLETED' }];
    expect(getReservationPaidAmount(payments)).toBe(50000);
  });

  // Prioridad 2 — contratos numéricos
  it('sin pagos retorna 0', () => {
    expect(getReservationPaidAmount([])).toBe(0);
  });

  it('overpaid retorna la suma sin techo (no descuenta del total)', () => {
    const payments = [
      { amount: '150000', status: 'COMPLETED', paymentType: 'RESERVATION' },
    ];
    // No hay filtro anti-overpayment en este helper; eso lo maneja getReservationPendingAmount
    expect(getReservationPaidAmount(payments)).toBe(150000);
  });

  it('null / undefined / "" en amount se trata como 0 sin crash', () => {
    const payments = [
      { amount: null, status: 'COMPLETED' },
      { amount: undefined, status: 'COMPLETED' },
      { amount: '', status: 'COMPLETED' },
      { amount: '50000', status: 'COMPLETED' },
    ];
    expect(getReservationPaidAmount(payments)).toBe(50000);
  });

  // Prioridad 3 — cobertura runtime
  it('status inválido no cuenta', () => {
    const payments = [
      { amount: '50000', status: 'UNKNOWN' },
      { amount: '40000', status: '' },
      { amount: '30000', status: null },
      { amount: '20000', status: 'COMPLETED' },
    ];
    expect(getReservationPaidAmount(payments)).toBe(20000);
  });

  it('paymentType null cuenta como RESERVATION', () => {
    const payments = [{ amount: '50000', status: 'COMPLETED', paymentType: null }];
    expect(getReservationPaidAmount(payments)).toBe(50000);
  });

  // Prioridad 4 — mezcla completa
  it('mezcla completa de payments calcula correctamente', () => {
    const payments = [
      { amount: '100000', status: 'COMPLETED', paymentType: 'RESERVATION' },    // cuenta
      { amount: '30000', status: 'PENDING', paymentType: 'RESERVATION' },       // no cuenta
      { amount: '20000', status: 'COMPLETED', paymentType: 'EXTRA' },           // no cuenta
      { amount: '15000', status: 'COMPLETED', paymentType: 'EXTRA' },           // no cuenta
      { amount: '25000', status: 'COMPLETED', paymentType: null },              // cuenta
      { amount: '10000', status: 'COMPLETED' },                                 // cuenta
      { amount: '5000', status: 'COMPLETED', paymentType: 'RESERVATION', deletedAt: '2025-01-01' }, // no cuenta
    ];
    expect(getReservationPaidAmount(payments)).toBe(135000); // 100000 + 25000 + 10000
  });
});

describe('getReservationPendingAmount', () => {
  it('sin pagos y totalPrice definido retorna el total', () => {
    expect(getReservationPendingAmount([], 100000)).toBe(100000);
  });

  it('overpaid retorna 0 (no negativo)', () => {
    const payments = [{ amount: '150000', status: 'COMPLETED', paymentType: 'RESERVATION' }];
    expect(getReservationPendingAmount(payments, 100000)).toBe(0);
  });

  it('totalPrice 0 retorna 0 (no -0)', () => {
    const payments = [{ amount: '0', status: 'COMPLETED' }];
    const result = getReservationPendingAmount(payments, 0);
    expect(Object.is(result, -0)).toBe(false);
    expect(result).toBe(0);
  });

  it('totalPrice null/undefined retorna 0', () => {
    const payments = [{ amount: '50000', status: 'COMPLETED' }];
    expect(getReservationPendingAmount(payments, null as any)).toBe(0);
    expect(getReservationPendingAmount(payments, undefined as any)).toBe(0);
  });

  it('pago partial retorna la diferencia correcta', () => {
    const payments = [{ amount: '40000', status: 'COMPLETED', paymentType: 'RESERVATION' }];
    expect(getReservationPendingAmount(payments, 100000)).toBe(60000);
  });

  it('EXTRAs no afectan pendingAmount', () => {
    const payments = [
      { amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' },
      { amount: '40000', status: 'COMPLETED', paymentType: 'EXTRA' },
    ];
    expect(getReservationPendingAmount(payments, 100000)).toBe(50000);
  });
});
