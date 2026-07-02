# ADR-0018: External Calendar Sync (iCal)

## Status

Aceptado

## Context

Los propietarios que gestionan sus propiedades en RentalPro y simultáneamente publican en canales externos (Airbnb, Booking.com, VRBO) enfrentan un problema de disponibilidad duplicada: las reservas externas no se reflejan automáticamente en RentalPro, lo que genera sobre-reservas o inconsistencias visuales en el calendario.

El objetivo de este issue (#129) es implementar la **importación** de ocupaciones desde feeds iCal de canales externos como **Bloqueos de Canal Externo** (no como Reservas), que consumen 1 unidad de disponibilidad cada uno. La exportación de calendarios queda fuera del alcance inicial (#130).

## Decision

### Modelo de datos

Se introducen dos modelos en Prisma:

- **ExternalCalendar**: representa un feed iCal asociado a una propiedad y canal. Se identifica por `(channel, propertyId, feedUrl)`. El soft delete se implementa vía `isActive: false` (no se elimina el registro).

- **ExternalChannelBlock**: representa un evento iCal importado. Se identifica por `(externalCalendarId, externalUid)`. Cada block activo consume 1 unidad de disponibilidad. Cuando un UID desaparece del feed, el block pasa a `status: INACTIVE` (no se elimina físicamente).

### Canal Externo (enum ExternalChannel)

```
AIRBNB | BOOKING_COM | VRBO | OTHER
```

### Parser iCal custom

Se implementa un parser custom en `src/lib/ical/parser.ts` (~150 LOC) sin dependencias externas, usando `Intl.DateTimeFormat` para formateo. Maneja:

- VEVENT bien formado → `{ startDate, endDate, uid, summary }`
- DTEND exclusivo (Airbnb/Booking): `endDate` interno = DTEND - 1 día
- DTEND inclusivo: sin resta (compatibilidad)
- TZID=America/Santiago → wall-time
- All-day (`DTSTART:20250115`) sin TZ → día calendario local
- Múltiples VEVENTs → array
- Sin `BEGIN:VCALENDAR` → error `INVALID_ICAL`
- Evento fuera de ventana `[-30d, +18m]` → filtrado

### Sync pipeline

`syncExternalCalendarPipeline(externalCalendarId)` en `src/lib/ical/sync.ts`:

1. Carga `ExternalCalendar` con `isActive: true`
2. Fetch del feed con timeout de 8 segundos
3. Valida Content-Type (si `text/html` sin `BEGIN:VCALENDAR` → error)
4. Parsea iCal
5. Upsert por `(externalCalendarId, externalUid)`:
   - UIDs en feed → upsert con `status: ACTIVE`
   - UIDs en DB que no están en feed → `status: INACTIVE`
6. Actualiza `lastSyncedAt`, `lastSyncError`, `lastSyncCount`

### Sync manual + automático

- **Manual**: server action `syncExternalCalendar()` (autenticada, plan PRO)
- **Automático**: endpoint API `POST /api/cron/external-calendars/sync` con auth `Bearer ${ICAL_CRON_SECRET}`, llamado diario por Vercel Cron a las 06:00 UTC

### Extensión de checkAvailability y getBlockedDates

`checkAvailability` ahora consulta `ExternalChannelBlock` con el mismo overlap query y suma 1 unidad por cada block activo que cubra el día. `getBlockedDates` incluye días cubiertos por blocks activos.

### Plan gating

Todas las actions mutadoras (`create`, `update`, `delete`, `sync`) requieren `session.plan === "PRO"`.

### Semántica de fuente: iCal NO es fuente financiera

El canal externo iCal cumple **exclusivamente** el rol de importador de ocupación para disponibilidad. Esto es deliberado y se enforces a nivel de modelo de datos y código:

1. **iCal no es fuente financiera.** El sync de `ExternalCalendar` solo escribe en `ExternalCalendar` y `ExternalChannelBlock`. Nunca crea, modifica ni cierra `Payment`.
2. **iCal no crea entidades de negocio.** El sync no inserta filas en `ReservationClient`, `Reservation`, `PaymentReminder` ni en tablas de auditoría (`ReservationChange`). Solo afecta disponibilidad visual y de `checkAvailability`.
3. **La conversión Bloqueo → Reserva es manual.** Cuando el owner quiere transformar un `ExternalChannelBlock` en una `Reservation` real con cobro, debe hacerlo desde la UI de calendario o de reservas — el sistema no lo hace automáticamente. Esto preserva el control del owner sobre precios, clientes y pagos.

Estas tres reglas evitan dos clases de bugs que aparecieron antes del bloque iCal:

- Cobros duplicados por un evento importado que no era una reserva real.
- "Reservas fantasma" generadas por canales con feeds ruidosos o desactualizados.

Cualquier futura integración con un canal externo que quiera crear `Payment`/`Reservation` automáticamente debe romper este contrato explícitamente y crear su propio ADR.

### ADR de referencia cruzada

- CONTEXT.md líneas 129-174 (se actualiza)
- #130 (export iCal, anti-reimport) — ver ADR-0019
- #131 (UI de calendario externo en dashboard)
- #132 (resolución de conflictos Reserva vs Bloqueo)
- ADR-0020 (zona horaria de negocio — todas las fechas iCal se interpretan en America/Santiago)

### Export side (#130)

La exportación de feeds iCal se implementa en `src/lib/ical/export.ts`, `src/lib/ical/serializer.ts`, y `src/lib/ical/tokens.ts`:

- **Forma**: `(propertyId, channel)` — un feed por canal externo.
- **Token**: SHA-256 hash en base64url (no bcrypt — bcrypt es demasiado lento para hot-path lookups de Airbnb polling).
- **Anti-eco**: El export excluye `ExternalChannelBlock` con `externalCalendar.channel === feed.channel`. Las Reservas siempre se incluyen.
- **Formatos**: iCal all-day only (DTSTART;VALUE=DATE, DTEND exclusive = endDate + 1 día para round-trip con el parser).
- **Seguridad**: Retorna 401 siempre (no 404/410) para evitar oráculo. Token válidado contra hash lookup O(1).
- **UX**: El token raw solo se muestra una vez al crear/regenerar.

## Consequences

### Positive

- Propietarios PRO pueden sincronizar disponibilidad desde canales externos sin doble gestión manual.
- Parser custom elimina dependencia externa y mantiene el bundle pequeño.
- Soft delete de blocks y calendars permite auditoría y recuperación.
- El sync es idempotente: UIDs stabilizan el estado.

### Negative

- Solo plan PRO (verificado en cada action mutadora)
- No hay exportación en este issue (#130)
- Anti-reimport (exportar no re-importe el mismo canal) queda para #130
- Resolución de conflictos visuales (Reserva vs Bloqueo) queda para #132

### Technical Notes

- El parser usa `Intl.DateTimeFormat` para formateo de fechas en la ventana de filtering, no para parsing.
- El timezone `America/Santiago` se trata como wall-time local; conversión UTC completa requeriría datos de offset por fecha (no incluido en scope inicial).
- El sync falla gracefully: conserva `lastSyncedAt` previo y persiste `lastSyncError` para debugging.
