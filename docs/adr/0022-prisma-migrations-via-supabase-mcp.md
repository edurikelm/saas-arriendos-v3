# ADR-0022: Aplicación de migraciones Prisma en Supabase via MCP

## Status

Aceptado

## Context

El proyecto RentalPro corre contra una base de datos Postgres de Supabase (proyecto `wmzjocdbhfrgwirzirjd`, región `us-east-2`) accedida vía Prisma 7 con el driver adapter `@prisma/adapter-pg`. La base tiene un historial de 15 migraciones aplicadas correctamente (ver `prisma/migrations/`).

Al intentar aplicar una nueva migración (`20260710000000_add_user_profile_settings_fields`) con `npx prisma migrate dev --name <...>`, la CLI falla con:

```
Error: P3006
Migration `20250508000000_add_integration_provider_enum` failed to apply cleanly
to the shadow database.
Error code: P3018
Database error code: 42P01
relation "UserIntegration" does not exist
```

Prisma intenta **replayar todas las migraciones históricas** en una shadow database temporal para validar que la nueva migración sea consistente con el esquema final. La shadow database arranca vacía y la migración de mayo 2025 referencia una tabla (`UserIntegration`) que solo se crea en migraciones posteriores, por lo que el replay falla.

El problema es de la shadow database, no de la base real: la BD de Supabase tiene todas las migraciones aplicadas correctamente y el esquema es válido. Pero `migrate dev` no puede distinguir entre "el esquema real está OK" y "no puedo validar la nueva migración".

Opciones consideradas:

1. **`prisma db push`**: sincroniza el esquema directamente sin pasar por migraciones. Descartado porque rompe el historial versionado.
2. **Arreglar la shadow database**: requiere intervención en el config de Prisma (`shadowDatabaseUrl`) y posiblemente recrear migraciones históricas. Alto riesgo de daño colateral.
3. **Aplicar SQL manualmente y registrar la migración en `_prisma_migrations`**: bypass el replay de shadow DB y mantiene el historial. Riesgo bajo si se hace correctamente.

## Decision

Cuando `prisma migrate dev` falle por un error de shadow database en migraciones históricas (no por la nueva migración), usar **Supabase MCP** para aplicar el SQL directamente y registrar la migración manualmente:

1. Crear el archivo de migración en `prisma/migrations/<timestamp>_<slug>/migration.sql` como siempre.
2. `npx prisma generate` para actualizar el cliente Prisma local.
3. Aplicar el SQL vía `supabase_apply_migration` (MCP) con `project_id` correcto.
4. Calcular el SHA-256 del archivo SQL y `INSERT` en `_prisma_migrations` con el checksum, `migration_name`, `finished_at = NOW()` y `applied_steps_count = 1`.
5. Reiniciar `next dev` para que Turbopack recargue el cliente Prisma actualizado (importante: Turbopack cachea el cliente aunque se haya regenerado).

Identificar el `project_id` correcto consultando `supabase_list_projects` y comparándolo con `DATABASE_URL` en `.env.local` (formato `postgresql://postgres.<project_ref>:...@aws-1-<region>.pooler.supabase.com:...`).

## Implementation

Aplicado por primera vez en commit `8b77651` (issue de redesign de `/settings`). Migración:

```
prisma/migrations/20260710000000_add_user_profile_settings_fields/migration.sql
```

— 9 columnas nuevas en `UserProfile`: `avatarUrl`, `phone`, `companyName`, `companyRut`, `companyAddress`, `language`, `currency`, `timezone`, `notificationsSmsEnabled`. Aplicada vía `supabase_apply_migration` MCP y registrada en `_prisma_migrations` con checksum SHA-256 calculado localmente.

```sql
-- Compute checksum in PowerShell:
$content = Get-Content -Raw "prisma/migrations/20260710000000_add_user_profile_settings_fields/migration.sql"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
$hex = -join ($hash | ForEach-Object { $_.ToString("x2") })
```

```sql
-- Register migration manually:
INSERT INTO "_prisma_migrations"
  (id, migration_name, checksum, finished_at, applied_steps_count, started_at)
VALUES (
  gen_random_uuid()::text,
  '20260710000000_add_user_profile_settings_fields',
  '<sha256-hex>',
  NOW(),
  1,
  NOW()
);
```

## Consequences

### Positive

- No requiere tocar migraciones históricas ni alterar configuración de Prisma.
- Mantiene el historial versionado y los checksums correctos en `_prisma_migrations`.
- Bypass el problema conocido de shadow DB sin riesgo de dañar el esquema real.
- Procedimiento replicable: cualquier agente futuro puede aplicarlo siguiendo los 5 pasos.

### Negative

- No hay validación automática de que la migración nueva sea consistente con el historial completo. Confiamos en la revisión manual del SQL.
- El checksum se calcula manualmente — un cambio posterior al archivo después de aplicarlo causaría drift detectable por `prisma migrate dev` futuros.
- Si la shadow DB falla por una razón distinta a replay histórico, este workaround no aplica y hay que investigar.

### Cuándo NO usar este workaround

- Si la nueva migración falla por SQL inválido, constraint violated, o tipo de dato incorrecto — esos son errores reales y hay que arreglar la migración.
- Si la BD de dev/real está desincronizada del historial (`prisma migrate status` reporta drift) — primero resolver drift con `prisma migrate resolve` o `migrate deploy`.

## References

- `docs/adr/0017-delegation-routing.md` — proceso de decisión entre agente directo y subagentes
- `prisma/migrations/` — historial de migraciones aplicadas
- Supabase MCP: `supabase_apply_migration`, `supabase_execute_sql`, `supabase_list_projects`