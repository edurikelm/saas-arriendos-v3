-- Add monthly payment fields to Payment
ALTER TABLE "Payment" ADD COLUMN "installmentIndex" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMP(3);