import { describe, it, expect } from 'vitest';
import { generateMonthlyPayments } from '../monthly';

describe('generateMonthlyPayments', () => {
  it('genera 3 pagos para 3 meses', () => {
    const startDate = new Date('2025-01-15');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 3, monthlyPrice, 1);
    expect(payments).toHaveLength(3);
  });

  it('el installmentIndex empieza en 1 y es secuencial', () => {
    const startDate = new Date('2025-01-15');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 3, monthlyPrice, 1);
    expect(payments[0].installmentIndex).toBe(1);
    expect(payments[1].installmentIndex).toBe(2);
    expect(payments[2].installmentIndex).toBe(3);
  });

  it('el dueDate del primer pago es día 1 del mes siguiente a startDate', () => {
    const startDate = new Date('2025-01-15');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 3, monthlyPrice, 1);
    expect(payments[0].dueDate.getDate()).toBe(1);
    expect(payments[0].dueDate.getMonth()).toBe(1);
    expect(payments[0].dueDate.getFullYear()).toBe(2025);
  });

  it('el dueDate del segundo pago es día 1 del mes siguiente al primero', () => {
    const startDate = new Date('2025-01-15');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 3, monthlyPrice, 1);
    expect(payments[1].dueDate.getDate()).toBe(1);
    expect(payments[1].dueDate.getMonth()).toBe(2);
    expect(payments[1].dueDate.getFullYear()).toBe(2025);
  });

  it('el amount es monthlyPrice × unitsBooked', () => {
    const startDate = new Date('2025-01-15');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 3, monthlyPrice, 2);
    expect(Number(payments[0].amount)).toBe(200000);
  });

  it('todos los pagos tienen status PENDING', () => {
    const startDate = new Date('2025-01-15');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 3, monthlyPrice, 1);
    payments.forEach(payment => {
      expect(payment.status).toBe('PENDING');
    });
  });

  it('todos los pagos tienen method MERCADO_PAGO', () => {
    const startDate = new Date('2025-01-15');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 3, monthlyPrice, 1);
    payments.forEach(payment => {
      expect(payment.method).toBe('MERCADO_PAGO');
    });
  });

  it('startDate 31 de enero con 1 mes genera dueDate 1 de febrero', () => {
    const startDate = new Date('2025-01-31');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 1, monthlyPrice, 1);
    expect(payments[0].dueDate.getDate()).toBe(1);
    expect(payments[0].dueDate.getMonth()).toBe(1);
    expect(payments[0].dueDate.getFullYear()).toBe(2025);
  });
});