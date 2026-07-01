# ADR-0019: iCal Export Feed (anti-reimport)

## Status

Aceptado

## Context

Para que los canales externos (Airbnb, Booking.com, VRBO) puedan sincronizar disponibilidad desde RentalPro, se necesita exportar un feed iCal. El challenge es evitar el "eco" (re-importar bloqueos hacia el mismo canal que los generó).

## Decision

### Forma del feed

Un feed por `(propertyId, channel)`. No un feed por propiedad general — eso no permitiría el anti-eco.

### Token storage

SHA-256 hash en base64url (~44 chars). **No bcrypt** — bcrypt es demasiado lento para hot-path lookups (Airbnb puede poll every few minutes). Un solo hash lookup es O(1).

### Formato iCal

All-day only (RFC 5545):
- `DTSTART;VALUE=DATE:YYYYMMDD`
- `DTEND;VALUE=DATE:YYYYMMDD` — **exclusive** (DTEND = internal endDate + 1 día para mantener round-trip con el parser)

### Anti-eco

Filtro en `buildExportEvents`:
- Reservations: **siempre incluidas** (domain-level)
- ExternalChannelBlocks: `WHERE externalCalendar.channel != feedChannel`

Esto previene que un bloque importado desde Airbnb se re-exporte hacia Airbnb.

### Seguridad

- Token válidado con hash lookup → 401 si no existe o está revocado
- Channel match check (anti-oracle): si el token existe pero el channel no coincide → 401
- **Siempre 401** (no 404 ni 410) para evitar oráculo de existencia
- El token raw **nunca** se muestra después de la creación (one-shot reveal)

### Ventana de tiempo

Default: `[today - 30d, today + 18m]`. Parametrizable para testabilidad.

## Consecuencias

### Positive

- Canales externos pueden poll disponibilidad sin eco
- Token hash permite lookups rápidos
- One-shot reveal previene leaks

### Negative

- Un feed por canal (más URLs para gestionar)
- Si el owner cambia el channel del calendario externo, el feed sigue apuntando al canal original

## Arquitectura de archivos

- `src/lib/ical/tokens.ts` — `generateExportToken`, `hashExportToken`
- `src/lib/ical/serializer.ts` — `serializeIcal`
- `src/lib/ical/export.ts` — `buildExportEvents` (anti-eco filter)
- `src/lib/actions/property-export-feeds.ts` — server actions CRUD
- `src/app/api/ical/export/route.ts` — GET endpoint público

## Referencias

- Parser iCal: `src/lib/ical/parser.ts` (DTEND exclusive semantics)
- ADR-0018: External Calendar Sync (import side)
