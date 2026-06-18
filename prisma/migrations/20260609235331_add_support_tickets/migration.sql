-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('RESERVATIONS', 'PAYMENTS', 'PROPERTIES', 'ACCOUNT', 'OTHER');
-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "affectedReservationId" TEXT,
    "affectedPaymentId" TEXT,
    "affectedPropertyId" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "supportTicketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "SupportTicketRead" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicketRead_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "SupportMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessageAttachment_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");
-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
-- CreateIndex
CREATE INDEX "SupportTicket_lastActivityAt_idx" ON "SupportTicket"("lastActivityAt");
-- CreateIndex
CREATE INDEX "SupportTicket_affectedReservationId_idx" ON "SupportTicket"("affectedReservationId");
-- CreateIndex
CREATE INDEX "SupportTicket_affectedPaymentId_idx" ON "SupportTicket"("affectedPaymentId");
-- CreateIndex
CREATE INDEX "SupportTicket_affectedPropertyId_idx" ON "SupportTicket"("affectedPropertyId");
-- CreateIndex
CREATE INDEX "SupportMessage_supportTicketId_idx" ON "SupportMessage"("supportTicketId");
-- CreateIndex
CREATE INDEX "SupportMessage_authorId_idx" ON "SupportMessage"("authorId");
-- CreateIndex
CREATE INDEX "SupportTicketRead_ticketId_idx" ON "SupportTicketRead"("ticketId");
-- CreateIndex
CREATE INDEX "SupportTicketRead_userId_idx" ON "SupportTicketRead"("userId");
-- CreateIndex
CREATE UNIQUE INDEX "SupportTicketRead_ticketId_userId_key" ON "SupportTicketRead"("ticketId", "userId");
-- CreateIndex
CREATE INDEX "SupportMessageAttachment_messageId_idx" ON "SupportMessageAttachment"("messageId");
-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_affectedReservationId_fkey" FOREIGN KEY ("affectedReservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_affectedPaymentId_fkey" FOREIGN KEY ("affectedPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_affectedPropertyId_fkey" FOREIGN KEY ("affectedPropertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SupportTicketRead" ADD CONSTRAINT "SupportTicketRead_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SupportMessageAttachment" ADD CONSTRAINT "SupportMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
