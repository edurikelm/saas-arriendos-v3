-- Captador: persona a cargo del owner que le consigue arrendatarios y se lleva
-- un porcentaje del arriendo. NO es un usuario del sistema. Ver ADR-0040.
--
-- `defaultCommissionRate` es un PORCENTAJE, no una fracción: 10.00 = 10%.

-- CreateTable
CREATE TABLE "Broker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "rut" TEXT,
    "defaultCommissionRate" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Broker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Broker_userId_idx" ON "Broker"("userId");

-- AddForeignKey
ALTER TABLE "Broker" ADD CONSTRAINT "Broker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Quién captó la reserva y con qué porcentaje, congelado al crear.
--
-- Aditivo y nullable a propósito: todas las reservas históricas quedan sin
-- captador, que es el caso correcto, y el código anterior a esta migración las
-- ignora. No hay backfill posible ni deseable.
--
-- `commissionRate` vive en la reserva y no se lee del captador en ninguna
-- lectura posterior. Eso es lo que hace segura la derivación del monto de la
-- comisión (ADR-0040 §2 y §3): cambiar el porcentaje por defecto del captador
-- no puede mover un peso de lo ya registrado.
ALTER TABLE "Reservation" ADD COLUMN "brokerId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "commissionRate" DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "Reservation_brokerId_idx" ON "Reservation"("brokerId");

-- RESTRICT y no SET NULL: un captador con reservas no se borra, se desactiva
-- (`active = false`). Perder el `brokerId` de una reserva histórica borraría la
-- evidencia de una comisión ya pagada.
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
