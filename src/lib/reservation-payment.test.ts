import { describe, it, expect } from 'vitest';
import { getPaymentStatus } from './reservation-payment';

describe('getPaymentStatus', () => {
  describe('badge label and variant', () => {
    it('returns "Pagado" with variant "default" when paidAmount === totalPrice and totalPrice > 0', () => {
      const result = getPaymentStatus({
        paidAmount: 100000,
        totalPrice: 100000,
        status: 'CONFIRMED',
      });
      expect(result.label).toBe('Pagado');
      expect(result.variant).toBe('default');
    });

    it('returns "Parcial" with variant "secondary" when 0 < paidAmount < totalPrice', () => {
      const result = getPaymentStatus({
        paidAmount: 50000,
        totalPrice: 100000,
        status: 'CONFIRMED',
      });
      expect(result.label).toBe('Parcial');
      expect(result.variant).toBe('secondary');
    });

    it('returns "Pendiente" with variant "destructive" when paidAmount === 0', () => {
      const result = getPaymentStatus({
        paidAmount: 0,
        totalPrice: 100000,
        status: 'PENDING',
      });
      expect(result.label).toBe('Pendiente');
      expect(result.variant).toBe('destructive');
    });

    it('returns "Pagado" with variant "default" when status is COMPLETED (ignoring paidAmount)', () => {
      const result = getPaymentStatus({
        paidAmount: 0,
        totalPrice: 100000,
        status: 'COMPLETED',
      });
      expect(result.label).toBe('Pagado');
      expect(result.variant).toBe('default');
    });

    it('returns "—" with variant "outline" when status is CANCELLED (ignoring paidAmount)', () => {
      const result = getPaymentStatus({
        paidAmount: 50000,
        totalPrice: 100000,
        status: 'CANCELLED',
      });
      expect(result.label).toBe('—');
      expect(result.variant).toBe('outline');
    });
  });

  describe('dot color', () => {
    it('returns green (#10B981) when fully paid (100%)', () => {
      const result = getPaymentStatus({
        paidAmount: 100000,
        totalPrice: 100000,
        status: 'CONFIRMED',
      });
      expect(result.color).toBe('#10B981');
    });

    it('returns yellow (#F59E0B) when partial payment (1-99%)', () => {
      const result = getPaymentStatus({
        paidAmount: 1,
        totalPrice: 100000,
        status: 'CONFIRMED',
      });
      expect(result.color).toBe('#F59E0B');
    });

    it('returns red (#EF4444) when no payment ($0)', () => {
      const result = getPaymentStatus({
        paidAmount: 0,
        totalPrice: 100000,
        status: 'PENDING',
      });
      expect(result.color).toBe('#EF4444');
    });

    it('returns green for COMPLETED regardless of paidAmount', () => {
      const result = getPaymentStatus({
        paidAmount: 0,
        totalPrice: 100000,
        status: 'COMPLETED',
      });
      expect(result.color).toBe('#10B981');
    });

    it('returns red for CANCELLED (using paidAmount logic)', () => {
      const result = getPaymentStatus({
        paidAmount: 50000,
        totalPrice: 100000,
        status: 'CANCELLED',
      });
      expect(result.color).toBe('#EF4444');
    });
  });

  describe('tooltip', () => {
    it('shows correct format: "Pagado: $XX.XXX / Total: $XX.XXX"', () => {
      const result = getPaymentStatus({
        paidAmount: 50000,
        totalPrice: 100000,
        status: 'CONFIRMED',
      });
      expect(result.tooltip).toBe('Pagado: $50.000 / Total: $100.000');
    });

    it('shows $0 when paidAmount is 0', () => {
      const result = getPaymentStatus({
        paidAmount: 0,
        totalPrice: 100000,
        status: 'PENDING',
      });
      expect(result.tooltip).toBe('Pagado: $0 / Total: $100.000');
    });

    it('shows full amount when fully paid', () => {
      const result = getPaymentStatus({
        paidAmount: 100000,
        totalPrice: 100000,
        status: 'CONFIRMED',
      });
      expect(result.tooltip).toBe('Pagado: $100.000 / Total: $100.000');
    });
  });

  describe('edge cases', () => {
    it('handles totalPrice of 0 (free reservation)', () => {
      const result = getPaymentStatus({
        paidAmount: 0,
        totalPrice: 0,
        status: 'CONFIRMED',
      });
      expect(result.label).toBe('Pagado');
      expect(result.color).toBe('#10B981');
    });

    it('treats COMPLETED with 0 total as Pagado', () => {
      const result = getPaymentStatus({
        paidAmount: 0,
        totalPrice: 0,
        status: 'COMPLETED',
      });
      expect(result.label).toBe('Pagado');
    });

    it('handles string paidAmount and number totalPrice', () => {
      const result = getPaymentStatus({
        paidAmount: '50000',
        totalPrice: 100000,
        status: 'CONFIRMED',
      });
      expect(result.label).toBe('Parcial');
    });

    it('handles number paidAmount and string totalPrice', () => {
      const result = getPaymentStatus({
        paidAmount: 50000,
        totalPrice: '100000',
        status: 'CONFIRMED',
      });
      expect(result.label).toBe('Parcial');
    });

    it('handles both paidAmount and totalPrice as strings', () => {
      const result = getPaymentStatus({
        paidAmount: '100000',
        totalPrice: '100000',
        status: 'CONFIRMED',
      });
      expect(result.label).toBe('Pagado');
    });

    it('handles mixed types when fully paid (string paidAmount, number totalPrice)', () => {
      const result = getPaymentStatus({
        paidAmount: '100000',
        totalPrice: 100000,
        status: 'CONFIRMED',
      });
      expect(result.label).toBe('Pagado');
    });

    it('handles mixed types when fully paid (number paidAmount, string totalPrice)', () => {
      const result = getPaymentStatus({
        paidAmount: 100000,
        totalPrice: '100000',
        status: 'CONFIRMED',
      });
      expect(result.label).toBe('Pagado');
    });
  });
});
