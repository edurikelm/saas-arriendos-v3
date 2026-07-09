-- Add Payment model indexes for KPI query performance
CREATE INDEX "Payment_deletedAt_idx" ON "public"."Payment"("deletedAt" ASC);
CREATE INDEX "Payment_dueDate_idx" ON "public"."Payment"("dueDate" ASC);
CREATE INDEX "Payment_paidAt_idx" ON "public"."Payment"("paidAt" ASC);
CREATE INDEX "Payment_paymentType_idx" ON "public"."Payment"("paymentType" ASC);
CREATE INDEX "Payment_reservationId_status_idx" ON "public"."Payment"("reservationId" ASC, "status" ASC);
CREATE INDEX "Payment_status_idx" ON "public"."Payment"("status" ASC);
