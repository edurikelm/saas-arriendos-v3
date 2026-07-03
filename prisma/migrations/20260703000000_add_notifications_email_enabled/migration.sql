-- Add per-user email opt-out preference for notifications
ALTER TABLE "UserProfile" ADD COLUMN "notificationsEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
