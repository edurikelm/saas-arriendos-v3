import { describe, it, expect } from 'vitest';
import { generateMonthlyPayments } from '../monthly';

/**
 * Tests del módulo `lib/payments/monthly.ts`.
 *
 * Fuente de verdad para la semántica de `dueDate`:
 * - CONTEXT.md línea 89-90: `due_date` = día 1 de cada mes cubierto,
 *   empezando por el mes de `start_date`.
 * - ADR-0012 (Monthly payment generation): "ej: Sep 1 → Sep 1, Oct 1, Nov 1".
 *
 * El primer `dueDate` es el día 1 del **mismo mes** de `start_date`,
 * NO el mes siguiente. La implementación actual respeta el contrato.
 *
 * Históricamente estos tests esperaban 'mes siguiente' (semántica
 * subscription-style) y fallaban porque contradecían ADR-0012. Se
 * actualizaron en este commit para alinear con la fuente de verdad.
 */
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

  // Per ADR-0012/CONTEXT.md: el primer dueDate es el día 1 del MISMO mes
  // que startDate, no el mes siguiente.
  it('el dueDate del primer pago es día 1 del mes de startDate (no del siguiente)', () => {
    const startDate = new Date('2025-01-15');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 3, monthlyPrice, 1);
    expect(payments[0].dueDate.getDate()).toBe(1);
    expect(payments[0].dueDate.getMonth()).toBe(0); // Enero (mismo mes que startDate)
    expect(payments[0].dueDate.getFullYear()).toBe(2025);
  });

  it('el dueDate del segundo pago es día 1 del mes siguiente al de startDate', () => {
    const startDate = new Date('2025-01-15');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 3, monthlyPrice, 1);
    expect(payments[1].dueDate.getDate()).toBe(1);
    expect(payments[1].dueDate.getMonth()).toBe(1); // Febrero (siguiente después de Enero)
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

  // Edge case: startDate al final del mes. Per ADR-0012 el primer pago es
  // día 1 del MES MISMO (enero) aunque startDate sea 31 de enero — el
  // contrato mensual tiene su dueDate fijo al día 1.
  it('startDate 31 de enero con 1 mes genera dueDate 1 de enero (mismo mes, no el siguiente)', () => {
    const startDate = new Date('2025-01-31');
    const monthlyPrice = '100000' as any;
    const payments = generateMonthlyPayments(startDate, 1, monthlyPrice, 1);
    expect(payments[0].dueDate.getDate()).toBe(1);
    expect(payments[0].dueDate.getMonth()).toBe(0); // Enero (mismo mes), no Febrero
    expect(payments[0].dueDate.getFullYear()).toBe(2025);
  });
});
