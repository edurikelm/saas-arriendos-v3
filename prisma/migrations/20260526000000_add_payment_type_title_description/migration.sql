-- Add payment type and metadata fields for extra payments
CREATE TYPE "PaymentType" AS ENUM ('RESERVATION', 'EXTRA');

ALTER TABLE "Payment"
ADD COLUMN "paymentType" "PaymentType" NOT NULL DEFAULT 'RESERVATION',
ADD COLUMN "title" TEXT,
ADD COLUMN "description" TEXT;
