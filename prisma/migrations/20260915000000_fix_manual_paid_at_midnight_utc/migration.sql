-- Corrige 6 cuotas cuyo `paidAt` quedó a medianoche UTC (ADR-0037, sección 4).
--
-- `MarkPaidDialog` enviaba `new Date("YYYY-MM-DD")`: el día que eligió el owner, pero a las
-- 00:00 UTC, que en Santiago es el día ANTERIOR a las 20:00/21:00. El detalle de la reserva las
-- muestra pagadas un día antes. La fecha por defecto del diálogo era el día local del navegador
-- (`format(new Date(), "yyyy-MM-dd")`), así que el día UTC guardado es el día que se eligió.
--
-- Cada fila pasa al valor que escribe hoy `businessNoonOfDateKey(día)`: inicio del día de
-- Santiago + 12 h. Son literales y no una expresión SQL porque el 2026-09-06 (inicio del horario
-- de verano, un día de 23 horas) "inicio + 12 h" es 16:00 UTC y el mediodía de reloj sería 15:00.
-- Los dos caen en el mismo día en Santiago y en UTC; se usa el de la app para que estas filas
-- queden igual que un pago registrado hoy.
--
-- Ninguna cruza un borde de mes ni de día UTC, así que ninguna cifra de /reports cambia.
--
-- Cada UPDATE exige el id Y el valor viejo exacto: en cualquier otra base (dev, shadow de
-- `prisma migrate dev`) no toca nada, y si alguien editó una de estas cuotas a mano, se respeta.
-- Inventario tomado de producción el 2026-09-15: son las únicas filas con `paidAt` a las
-- 00:00:00.000 UTC exacto.
UPDATE "Payment" AS p
SET "paidAt" = v.new_paid_at
FROM (VALUES
  ('cmtd3qkuq000204jpf3y71yqv', TIMESTAMP '2026-08-28 00:00:00', TIMESTAMP '2026-08-28 16:00:00'),
  ('cmtd3qkv8000304jpwjpte7t9', TIMESTAMP '2026-08-28 00:00:00', TIMESTAMP '2026-08-28 16:00:00'),
  ('cmtddshvl0002yskvux7vq162', TIMESTAMP '2026-09-06 00:00:00', TIMESTAMP '2026-09-06 16:00:00'),
  ('cmtddsi0e0003yskvd47hfuh5', TIMESTAMP '2026-09-06 00:00:00', TIMESTAMP '2026-09-06 16:00:00'),
  ('cmtddsi500004yskv9ylwkbnp', TIMESTAMP '2026-09-09 00:00:00', TIMESTAMP '2026-09-09 15:00:00'),
  ('cmtddsi9k0005yskvnllnc2zh', TIMESTAMP '2026-09-09 00:00:00', TIMESTAMP '2026-09-09 15:00:00')
) AS v(id, old_paid_at, new_paid_at)
WHERE p."id" = v.id
  AND p."paidAt" = v.old_paid_at;
