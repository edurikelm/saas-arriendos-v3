-- CreateEnum
CREATE TYPE "ExternalChannel" AS ENUM ('AIRBNB', 'BOOKING_COM', 'VRBO', 'OTHER');
-- CreateEnum
CREATE TYPE "ExternalBlockStatus" AS ENUM ('ACTIVE', 'INACTIVE');
-- CreateTable
CREATE TABLE "ExternalCalendar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "channel" "ExternalChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "lastSyncCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalCalendar_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ExternalChannelBlock" (
    "id" TEXT NOT NULL,
    "externalCalendarId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "externalUid" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "status" "ExternalBlockStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalChannelBlock_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "ExternalCalendar_userId_idx" ON "ExternalCalendar"("userId");
-- CreateIndex
CREATE INDEX "ExternalCalendar_propertyId_idx" ON "ExternalCalendar"("propertyId");
-- CreateIndex
CREATE INDEX "ExternalCalendar_userId_isActive_idx" ON "ExternalCalendar"("userId", "isActive");
-- CreateIndex
CREATE INDEX "ExternalCalendar_propertyId_isActive_idx" ON "ExternalCalendar"("propertyId", "isActive");
-- CreateIndex
CREATE INDEX "ExternalChannelBlock_externalCalendarId_idx" ON "ExternalChannelBlock"("externalCalendarId");
-- CreateIndex
CREATE INDEX "ExternalChannelBlock_propertyId_status_idx" ON "ExternalChannelBlock"("propertyId", "status");
-- CreateIndex
CREATE INDEX "ExternalChannelBlock_propertyId_startDate_endDate_idx" ON "ExternalChannelBlock"("propertyId", "startDate", "endDate");
-- CreateIndex
CREATE INDEX "ExternalChannelBlock_status_idx" ON "ExternalChannelBlock"("status");
-- CreateIndex
CREATE UNIQUE INDEX "ExternalChannelBlock_externalCalendarId_externalUid_key" ON "ExternalChannelBlock"("externalCalendarId", "externalUid");
-- AddForeignKey
ALTER TABLE "ExternalCalendar" ADD CONSTRAINT "ExternalCalendar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ExternalCalendar" ADD CONSTRAINT "ExternalCalendar_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ExternalChannelBlock" ADD CONSTRAINT "ExternalChannelBlock_externalCalendarId_fkey" FOREIGN KEY ("externalCalendarId") REFERENCES "ExternalCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ExternalChannelBlock" ADD CONSTRAINT "ExternalChannelBlock_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
