-- Add Mercado Pago metadata fields to Payment model
-- See PRD-0004 (docs/prd/PRD-0004-mp-payment-metadata-pdf.md) and ADR-0026
-- (docs/adr/0026-mp-payment-metadata-storage.md).

-- All fields are nullable with no defaults (no backfill of historical payments).
-- The @unique constraint on mpPaymentId is informational; duplicate payment IDs
-- from Mercado Pago should not occur in practice.

-- Payment ID from MP (numeric, distinct from mercadoPagoId which is preference_id)
ALTER TABLE "Payment" ADD COLUMN "mpPaymentId" TEXT;

-- Status detail from MP (e.g. accredited, pending_contingency)
ALTER TABLE "Payment" ADD COLUMN "mpStatusDetail" TEXT;

-- Payment method ID (e.g. visa, mastercard, account_money)
ALTER TABLE "Payment" ADD COLUMN "mpPaymentMethodId" TEXT;

-- Payment type (e.g. credit_card, debit_card, bank_transfer)
ALTER TABLE "Payment" ADD COLUMN "mpPaymentType" TEXT;

-- Last 4 digits of card used -- NOT encrypted (not sensitive per PCI DSS v4.0)
ALTER TABLE "Payment" ADD COLUMN "mpCardLastFour" TEXT;

-- Number of installments
ALTER TABLE "Payment" ADD COLUMN "mpInstallments" INTEGER;

-- Gross amount charged to customer
ALTER TABLE "Payment" ADD COLUMN "mpTransactionAmount" NUMERIC(10, 2);

-- Net amount received by owner after commission
ALTER TABLE "Payment" ADD COLUMN "mpNetReceivedAmount" NUMERIC(10, 2);

-- MP commission fee amount
ALTER TABLE "Payment" ADD COLUMN "mpFeeAmount" NUMERIC(10, 2);

-- Date the payment was created in MP
ALTER TABLE "Payment" ADD COLUMN "mpDateCreated" TIMESTAMP(3);

-- Unique constraint on mpPaymentId (nullable; unique only when set)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_mpPaymentId_key" UNIQUE ("mpPaymentId");
