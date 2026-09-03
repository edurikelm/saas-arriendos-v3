-- Concesión manual de PRO por un admin. `null` = derivar de la Subscription.
ALTER TABLE "UserProfile" ADD COLUMN "planOverride" "Plan";

-- Backfill: preservar las concesiones manuales existentes.
--
-- Un owner con plan = 'PRO' y SIN NINGUNA fila de Subscription solo puede
-- haber llegado a PRO por el panel de admin (`updateUserPlan` escribía la
-- columna directo). Ese caso se convierte en override explícito.
--
-- Deliberadamente NO se usa "sin subscription VIGENTE": el plan cacheado no se
-- degradaba nunca por la vía natural (`expired_check` no disparaba cambio de
-- plan), asi que hay filas con plan = 'PRO' y subscription vencida hace meses.
-- Tratarlas como concesión les regalaría PRO permanente. Con subscription
-- presente, el plan se deriva y la columna cacheada se ignora.
--
-- Límite conocido: si un admin concedió PRO a un owner que además tuvo alguna
-- subscription, esa concesión no es recuperable desde los datos —
-- `updateUserPlan` no escribía AdminActionLog. Hay que volver a aplicarla a
-- mano. Al momento de escribir esta migración: 0 filas en esa situación.
UPDATE "UserProfile" u
SET "planOverride" = 'PRO'
WHERE u."plan" = 'PRO'
  AND NOT EXISTS (
    SELECT 1 FROM "Subscription" s WHERE s."userId" = u."id"
  );
