# ADR-0026: Mercado Pago Payment Metadata — Storage Decisions

## Status

Aceptado (2026-07-17)

## Context

La issue #183 (PRD-0004) persite metadata rica del response de `GET /v1/payments/{id}` de Mercado Pago en el modelo `Payment`. Antes de implementar, hay que tomar tres decisiones de almacenamiento que tienen implicaciones de seguridad, auditoría y comportamiento.

### Campos a persistir

Del response de `GET /v1/payments/{id}` se capturan 10 campos nuevos en `Payment`:

| Campo | Tipo | Justificación |
|---|---|---|
| `mpPaymentId` | `String? @unique` | ID numérico de MP (distinto del `mercadoPagoId` que es `preference_id`). Llave cruzada directa con la consola de MP. |
| `mpStatusDetail` | `String?` | Detalle del status (ej: `accredited`, `pending_contingency`). Necesario para auditoría de por qué un pago quedó en estado particular. |
| `mpPaymentMethodId` | `String?` | Método exacto (ej: `visa`, `mastercard`, `account_money`). No solo "tarjeta" — el owner necesita saber cuál red. |
| `mpPaymentType` | `String?` | Tipo de pago (ej: `credit_card`, `debit_card`, `bank_transfer`). Completa el contexto del método. |
| `mpCardLastFour` | `String?` | Últimos 4 dígitos de la tarjeta. Permite al owner validar contra lo que el cliente dice que pagó. |
| `mpInstallments` | `Int?` | Número de cuotas. Relevante para arriendos donde el cliente paga en cuotas. |
| `mpTransactionAmount` | `Decimal?` | Monto bruto cobrado al cliente. Base para conciliar con el extracto bancario. |
| `mpNetReceivedAmount` | `Decimal?` | Monto neto acreditado al owner después de comisión. El真正 ingreso del owner. |
| `mpFeeAmount` | `Decimal?` | Comisión cobrada por MP. Necesaria para calcular márgenes reales. |
| `mpDateCreated` | `DateTime?` | Timestamp de creación del pago en MP. Más preciso que `paidAt` (hora del webhook). |

## Decision

### 1. Campos nullable, sin defaults, sin backfill

Todos los campos nuevos son `TYPE?` (nullable) sin valor por defecto. No se hace backfill de pagos históricos.

**Justificación:**
- Los pagos históricos ya completados no necesitan esta metadata para auditoría financiera básica (`paidAt` + `amount` son suficientes).
- Hacer backfill requeriría un script one-off que re-consulta MP para cada pago histórico, con rate limiting y tokens potencialmente revocados.
- El equipo puede ejecutar un re-fetch manual selectivo si en el futuro se necesita para un pago específico.
- Mantener los campos como nullable evita migración de datos masivos y riesgos de consistency.

### 2. NO encriptar `mpCardLastFour`

`mpCardLastFour` se almacena en texto plano, **sin encriptar**.

**Referencia PCI DSS v4.0:**

Según PCI DSS v4.0, los datos sensibles que están en scope para protección (encriptación, masking, etc.) son:

- PAN completo (Primary Account Number — el número de tarjeta completo)
- CVV/CVC (Card Verification Value)
- Cardholder name completo (en ciertos contextos)
- Magnetic stripe / chip data

Los **últimos 4 dígitos del PAN** (`last four`, `last4`) **NO son dato sensible** según PCI DSS:

1. Son información ya visible al owner en su propio dashboard de Mercado Pago.
2. No son un número primario de cuenta — no permiten identificar ni clonar la tarjeta.
3. PCI DSS permite-maskear (mostrar solo últimos 4) como práctica de display, pero **no requiere encriptación** de los últimos 4 cuando se almacenan.
4. Encardation würde bedeuten: más complejidad, clave management, posible data loss si se pierde la clave — con ningún beneficio de seguridad real.

Encriptar los últimos 4 dígitos sería sobre-engineering que añade riesgo operacional sin reducir riesgo real.

**Lo que NO se guarda (correcto):**
- PAN completo ❌
- CVV ❌
- Cardholder name completo ❌
- Magnetic stripe data ❌
- First six digits (BIN) ❌

### 3. Idempotencia del guardado de metadata

El guardado de metadata en el webhook **debe ser idempotente**.

**Constraint de diseño para #184:**

Cuando `processMercadoPagoWebhook` recibe metadata de MP y la persiste via `markPaymentCompleted` (o helper equivalente), la lógica debe:

1. **Si el pago ya tiene estado terminal** (`COMPLETED`) y ya tiene metadata poblada → no pisa ningún campo existente (idempotencia).
2. **Si el pago ya tiene estado terminal pero la metadata está vacía** → poblarla (re-fetch de un webhook perdido).
3. **Si el pago está en estado no-terminal** → actualizar normalmente.

La responsabilidad de implementar esta idempotencia vive en la issue #184. Este ADR registra la constraint como requisito del seam canónico.

## Implementation

### Schema (en `prisma/schema.prisma`)

```prisma
/// Metadata persistida del response GET /v1/payments/{id} de Mercado Pago.
/// Ver PRD-0004 (docs/prd/PRD-0004-mp-payment-metadata-pdf.md) y ADR-0026
/// (docs/adr/0026-mp-payment-metadata-storage.md).
/// Poblada por el webhook #184. Idempotencia garantizada en seam canónico.
mpPaymentId          String?   @unique
mpStatusDetail       String?
mpPaymentMethodId    String?
mpPaymentType        String?
mpCardLastFour       String?
mpInstallments       Int?
mpTransactionAmount  Decimal?  @db.Decimal(10, 2)
mpNetReceivedAmount  Decimal?  @db.Decimal(10, 2)
mpFeeAmount          Decimal?  @db.Decimal(10, 2)
mpDateCreated        DateTime?
```

### Migración

Migración `20260717000000_add_mp_payment_metadata` — 100% no destructiva:
- Solo `ALTER TABLE ADD COLUMN ... NULL` para los 10 campos.
- `UNIQUE` constraint sobre `mpPaymentId` creado con `NOT VALID` para no locking la tabla.
- Sin backfill, sin delete, sin update de filas existentes.

### Archivos cambiados

- `prisma/schema.prisma` — 10 campos + comment block
- `prisma/migrations/20260717000000_add_mp_payment_metadata/migration.sql` — SQL generado
- `docs/adr/0026-mp-payment-metadata-storage.md` — este ADR

## Consequences

### Positive

- Auditoría financiera más rica: el owner puede ver exactamente qué método de pago usó el cliente, cuántas cuotas, y cuánto neto recibió.
- Conciliación bancaria simplificada: `mpNetReceivedAmount` + `mpFeeAmount` permiten verificar el extracto MP sin calculadora.
- Llave cruzada con consola MP: `mpPaymentId` permite buscar directamente en dashboard de MP.
- Decisión de no encriptar evita complejidad operacional (key rotation, key loss) con riesgo real cero.
- Decisión de no backfill evita migración masiva y script one-off frágil.

### Negative

- Pagos históricos quedan sin metadata. Para auditoría de pagos viejos, el owner no tendrá los 4 dígitos, método exacto, ni comisión. Mitigación: los campos financieros (`amount`, `paidAt`) siguen presentes; la metadata es enriquecimiento, no la fuente de verdad.
- El comment block en el schema es ruido visual para quien no conoce MP. Mitigación: documentado aquí y en PRD-0004.

### Neutral

- Los 10 campos son nullable — las queries que usan `Payment` sin la metadata nueva siguen funcionando sin cambios.
- `mpPaymentId @unique` es un constraint técnico (no hay negocio donde el mismo payment ID de MP se asigne a dos `Payment` internos). Si ocurre un edge case, fallará la DB y se detectará.

## Future Work

- **Idempotencia explícita** (#184): implementar el guard de metadata ya poblada en `markPaymentCompleted` o helper del seam.
- **Re-fetch histórico**: script one-off opcional para poblar metadata de los últimos N pagos completados. Requiere token OAuth válido del owner. Out of scope para esta iteración.
- **UI de auditoría**: mostrar los campos nuevos en `PaymentDetail` o receipt PDF (#185). Out of scope para esta iteración.

## References

- PRD-0004: `docs/prd/PRD-0004-mp-payment-metadata-pdf.md`
- Issue #183: GitHub issue para esta migración de schema
- Issue #184: Webhook/gateway — capturar y persistir MP metadata (depende de #183)
- Issue #185: UI + API — descargar comprobante PDF (depende de #183 + #184)
- PCI DSS v4.0 — definición de SAD (Sensitive Authentication Data) y PAN masking
- CONTEXT.md — modelo `Payment` existente con `mercadoPagoId` (preference_id) y `receiptUrl`
