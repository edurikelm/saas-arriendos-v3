-- Add initPoint, expiresAt, deletedAt to Payment
ALTER TABLE "Payment" ADD COLUMN "initPoint" TEXT;
ALTER TABLE "Payment" ADD COLUMN "expiresAt" TIMESTAMP;
ALTER TABLE "Payment" ADD COLUMN "deletedAt" TIMESTAMP;