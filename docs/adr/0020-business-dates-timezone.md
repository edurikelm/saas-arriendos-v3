# ADR-0020: Business Dates Timezone (America/Santiago)

## Status

Aceptado

## Context

RentalPro se opera desde Chile (mercado MLC, CLP) y todo lo que el owner ve como "fecha del negocio" — vencimientos de pagos, alertas de cobranza, ventanas de disponibilidad, fechas importadas desde canales externos — debe coincidir con el wall-time local del usuario. Si el servidor corre en UTC y se hace `Date#getDate()` sin configurar zona horaria, un pago con `dueDate = "2025-03-01"` puede aparecer como "vencido hoy" un día antes o después según el offset del runtime (Vercel usa UTC).

A esto se suma que las fechas iCal que llegan de canales externos (Airbnb, Booking.com, VRBO) suelen llegar como all-day con TZID `America/Santiago` o sin TZ. Si el parser las convierte a UTC antes de almacenarlas, perdemos la noción de "día calendario local" que es la que el owner espera ver en el calendario visual.

Antes de este ADR ya existía la decisión implícita en el código (`BUSINESS_TIME_ZONE = "America/Santiago"` en `src/lib/alerts/collection-alerts.ts` y `tz === "America/Santiago"` en `src/lib/ical/parser.ts`) pero **no estaba documentada como decisión arquitectónica**, lo que la hacía frágil ante refactors y poco descubrible para nuevos miembros del equipo.

## Decision

### Regla única

**Todas las fechas de negocio se interpretan, calculan y muestran en wall-time `America/Santiago`.**

Esto aplica a:

- **Cobranza y vencimientos**: `Payment.dueDate`, cálculo de `vencidos / vencen hoy / próximos 7 días`.
- **Recordatorios de pago**: ventanas de aviso, días restantes, "vence mañana".
- **Disponibilidad de calendario**: cálculo de `checkAvailability`, `getBlockedDates`, sincronización iCal, export iCal.
- **Reservas y bloqueos externos**: `startDate` / `endDate` son fechas calendario locales, no timestamps UTC.

### Implementación

#### 1. Constante única

La zona se define en una sola constante por módulo responsable:

```ts
// src/lib/alerts/collection-alerts.ts
const BUSINESS_TIME_ZONE = "America/Santiago";
```

Futuros módulos que necesiten la misma zona deben importarla de un módulo compartido (`src/lib/domain/timezone.ts`) para evitar drift. Esta consolidación queda como follow-up de este ADR.

#### 2. Comparación de fechas calendario (collection-alerts)

Para calcular "días desde hoy" sin contaminarse con el offset UTC del servidor:

```ts
function getSantiagoDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return formatter.format(date); // "YYYY-MM-DD" (en-CA produce ese formato)
}
```

Se obtiene un `dateKey` ("YYYY-MM-DD") tanto para `now` como para el target, se parsea a componentes y se calcula la diferencia en días. Esto se cubre con tests en `src/lib/alerts/__tests__/collection-alerts.test.ts` ("respeta zona horaria America/Santiago en el corte del día").

#### 3. iCal parser (import side)

`src/lib/ical/parser.ts`:

- **All-day** (`DTSTART:20250115` sin `T` ni TZ): se interpreta como día calendario local — se construye con `new Date(year, month-1, day)` (hora 00:00 local), no con `Date.UTC`.
- **Con `TZID=America/Santiago`**: se trata como wall-time. La conversión completa a UTC requeriría offset por fecha (DST Chile: UTC-3/-4) y queda fuera de scope inicial — el caller recibe wall-time y debe aplicarlo en su zona.
- **Con `Z` (UTC)**: se mantiene la semántica UTC estándar (`Date.UTC(...)`).

#### 4. iCal serializer (export side)

`src/lib/ical/serializer.ts` exporta siempre all-day en formato `YYYYMMDD`. Para evitar desfases al construir el string, usa métodos `getUTC*` sobre la `Date` ya validada como día calendario local. Esto se documenta en el comentario del header del archivo:

> "Date handling: Uses UTC methods to avoid timezone issues when server is in a different timezone than the property's local date."

La precondición es que el `endDate` que llega al serializer ya representa día calendario local (no un timestamp UTC con hora).

#### 5. UI y visual

El frontend (Next.js, navegador) muestra fechas con `Intl.DateTimeFormat({ timeZone: "America/Santiago" })` cuando requiere consistencia de zona. Esto se respeta en componentes de calendario, listados de reservas y alertas. Para fechas date-only (`YYYY-MM-DD` que ya están en la convención del dominio), se renderizan directamente con formateo local.

### Relación con DST

Chile usa UTC-4 en invierno y UTC-3 en verano (segundo sábado de marzo / primer sábado de octubre, aproximado). Para esta decisión:

- Las fechas **date-only** (sin hora) no se ven afectadas por DST — son abstractas sobre la zona.
- Las fechas **con hora** se tratan siempre como wall-time, lo que es coherente con cómo Airbnb/Booking las entregan.
- El cálculo de "días entre dos fechas" usa siempre el `dateKey` en zona, por lo que un evento que cruza el cambio de DST sigue siendo "N días" en wall-time.

No se implementa offset por fecha individual en este ADR. Si en el futuro se necesita cálculo de horas exactas entre eventos en zona, se reabre el ADR.

### Lo que NO cubre este ADR

- Migración del runtime del servidor (sigue UTC en Vercel). Solo se afecta la interpretación y presentación.
- Localización de UI más allá de Chile (i18n, otros países). Hoy RentalPro es single-tenant por mercado.
- Timestamps de auditoría (`created_at`, `updated_at`) — siguen siendo UTC ISO-8601, que es la convención correcta.

## Consequences

### Positive

- Coherencia visual: el owner siempre ve "mañana" o "hoy" alineado con su reloj, no con el del servidor.
- Comparaciones de fechas robustas: el `dateKey` evita que un cambio de offset del runtime cause bugs sutiles en cobranza.
- Tests defensivos: `collection-alerts.test.ts` documenta explícitamente la regla, evitando regresiones silenciosas.
- Contrato claro para integraciones iCal: el parser/serializer hablan "día calendario en zona" en vez de "timestamp UTC".

### Negative

- Acoplamiento de toda la app a una sola zona. Migrar a multi-país requerirá refactor mayor y nuevo ADR.
- `Date#getDate()` y constructores naive siguen siendo una trampa para nuevos desarrolladores. La disciplina debe vivir en code review y en tests, no solo en este documento.
- No se modela offset por fecha (DST-aware). Para fechas con hora, esto es aceptable hoy; si se necesita precisión sub-día en reglas de cobranza nocturna, hay que revisitar.

### Technical Notes

- Una futura consolidación debería mover la constante a `src/lib/domain/timezone.ts` y re-exportar desde los módulos actuales para evitar duplicación.
- `Intl.DateTimeFormat("en-CA", ...)` produce formato `YYYY-MM-DD` por convención del locale canadiense. Es estable y se usa en tests.
- El patrón "dateKey → dayIndex" permite comparaciones sin zona en el cálculo de días, evitando errores por offset.

## References

- Implementación: `src/lib/alerts/collection-alerts.ts`, `src/lib/ical/parser.ts`, `src/lib/ical/serializer.ts`
- Tests: `src/lib/alerts/__tests__/collection-alerts.test.ts`
- CONTEXT.md secciones:
  - "Calendarios Externos" (iCal availability)
  - "Pagos" (cobranza y recordatorios)
- ADR-0018 (External Calendar Sync) — comparte la convención wall-time
- ADR-0019 (iCal Export Feed) — comparte la convención wall-time en serializer