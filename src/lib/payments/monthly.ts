import { Decimal } from '@prisma/client/runtime/client';
import type { PaymentStatus, PaymentMethod } from '@prisma/client';

type MonthlyPaymentInput = {
  amount: Decimal;
  method: PaymentMethod;
  status: PaymentStatus;
  dueDate: Date;
  installmentIndex: number;
};

export function generateMonthlyPayments(
  startDate: Date,
  months: number,
  monthlyPrice: Decimal,
  unitsBooked: number
): MonthlyPaymentInput[] {
  const payments: MonthlyPaymentInput[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < months; i++) {
    const dueDate = new Date(start.getFullYear(), start.getMonth() + i + 1, 1);
    const amount = new Decimal(monthlyPrice.toString()).mul(unitsBooked);

    payments.push({
      amount,
      method: 'MERCADO_PAGO',
      status: 'PENDING',
      dueDate,
      installmentIndex: i + 1,
    });
  }

  return payments;
}