-- Add user profile settings fields: avatar, company info, locale prefs, SMS notifications
ALTER TABLE "UserProfile" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "phone" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "companyName" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "companyRut" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "companyAddress" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "UserProfile" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CLP';
ALTER TABLE "UserProfile" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Santiago';
ALTER TABLE "UserProfile" ADD COLUMN "notificationsSmsEnabled" BOOLEAN NOT NULL DEFAULT false;
