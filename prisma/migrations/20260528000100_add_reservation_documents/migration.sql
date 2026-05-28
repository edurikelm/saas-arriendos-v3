CREATE TYPE "ReservationDocumentCategory" AS ENUM ('CONTRATO', 'ANEXO', 'INVENTARIO', 'OTRO');

CREATE TYPE "ReservationDocumentType" AS ENUM ('PDF', 'JPG', 'PNG', 'WEBP');

CREATE TABLE "ReservationDocument" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "category" "ReservationDocumentCategory" NOT NULL,
  "documentType" "ReservationDocumentType" NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReservationDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReservationDocument_reservationId_idx" ON "ReservationDocument"("reservationId");
CREATE INDEX "ReservationDocument_reservationId_deletedAt_idx" ON "ReservationDocument"("reservationId", "deletedAt");

ALTER TABLE "ReservationDocument"
ADD CONSTRAINT "ReservationDocument_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
