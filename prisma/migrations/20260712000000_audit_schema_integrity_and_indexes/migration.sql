-- Audit mini-audit 2026-07-12 — Bloque 3: schema integrity + indexes
-- Verificado pre-flight contra DB prod:
--   - Payment.mercadoPagoId: 0 duplicados, 6 NULLs (Postgres permite varios NULLs)
--   - ExternalCalendar: 0 registros (imposible violar constraint)
--   - Reservation: 10 reservas (índices son siempre seguros)
-- Cambios puramente aditivos, no requieren data cleanup.

-- S2: Unique constraint en Payment.mercadoPagoId para prevenir duplicados
-- del webhook de MercadoPago. El campo acepta NULL (Pagos manuales: CASH,
-- TRANSFER). Postgres standard trata NULLs como distintos en índices únicos,
-- por lo que múltiples payments manuales con mercadoPagoId = NULL coexisten
-- sin violar el constraint.
CREATE UNIQUE INDEX "Payment_mercadoPagoId_key" ON "Payment"("mercadoPagoId");

-- S3: Unique constraint en ExternalCalendar. El identificador canónico
-- (per CONTEXT.md) es la combinación (userId, channel, propertyId, feedUrl).
-- Previene que el mismo owner cree calendarios duplicados para el mismo
-- canal/propiedad/feed, lo que generaría sincronización doble de bloques.
CREATE UNIQUE INDEX "ExternalCalendar_userId_channel_propertyId_feedUrl_key"
  ON "ExternalCalendar"("userId", "channel", "propertyId", "feedUrl");

-- P3: Índices en Reservation.{startDate,endDate} para queries frecuentes de
-- calendario y reportes por rango de fechas. El schema actual solo tenía
-- índices en userId, propertyId, clientId — los date range scans hacían
-- sequential scan sobre la tabla de reservas.
CREATE INDEX "Reservation_startDate_idx" ON "Reservation"("startDate");
CREATE INDEX "Reservation_endDate_idx" ON "Reservation"("endDate");
