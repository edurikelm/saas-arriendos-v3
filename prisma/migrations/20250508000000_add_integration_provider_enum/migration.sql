-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('MERCADO_PAGO', 'STRIPE');

-- AlterTable
ALTER TABLE "UserIntegration" ALTER COLUMN "provider" TYPE "IntegrationProvider" USING "provider"::text::"IntegrationProvider";