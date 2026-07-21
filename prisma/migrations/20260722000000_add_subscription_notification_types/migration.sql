-- Add SUBSCRIPTION_ACTIVATED, SUBSCRIPTION_CANCELLED, SUBSCRIPTION_EXPIRED
-- to NotificationType enum.
--
-- PostgreSQL note: each ADD VALUE is a separate statement.  All three
-- can be in the same migration file because Prisma runs enum additions
-- outside the transaction block.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_ACTIVATED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_CANCELLED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_EXPIRED';
