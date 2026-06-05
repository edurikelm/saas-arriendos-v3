-- Add user status for admin lifecycle management
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

ALTER TABLE "UserProfile"
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
