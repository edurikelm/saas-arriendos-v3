-- Add PAYMENT_REVERTED to NotificationType enum
-- Note: PostgreSQL does not allow ADD VALUE inside a transaction block
-- in some versions. If `prisma db push` fails, run this manually:
--   ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REVERTED';
-- outside any transaction.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REVERTED';
