# PRD-0004: Comprobante de Pago Mercado Pago — Metadata Rica + PDF

## Problem Statement

Hoy, cuando un pago vía Mercado Pago se completa en RentalPro, el owner solo tiene:
- `paid_at` (timestamp)
- La opción de subir manualmente una imagen del comprobante a Cloudinary (vía `payment-row-actions.tsx` → `Adjuntar comprobante`).

No existe un comprobante "oficial del sistema" con **datos reales firmados por Mercado Pago** (últimos 4 dígitos, método de pago exacto, monto bruto, comisión MP, monto neto acreditado, fecha de aprobación, instalments). Y mucho menos un PDF descargable.

Verificación documental: la **API de Mercado Pago no expone un comprobante/PDF** para pagos con tarjeta, ni siquiera desde la cuenta collector del owner. Lo único automáticamente disponible son los reportes consolidados (`/v1/reports/...`), inútiles como comprobantes unitarios.

Por lo tanto, el owner:
- No puede demostrar a un cliente qué pagador, con qué tarjeta, cuánto y cuándo.
- No puede conciliar visualmente la comisión de MP.
- Para auditoría, depende de una imagen subida a mano que pudo haber sido substituida.

## Solution

Dos issues independientes (tracer-bullet):

### Issue 1 — Persistir metadata rica de MP en `Payment`
Capturar en el flujo del webhook los campos hoy descartados del response de `GET /v1/payments/{id}`:
- `mpPaymentId` (numérico de MP, distinto del `mercadoPagoId` que es el preference_id)
- `mpStatusDetail` (ej: `accredited`, `pending_contingency`)
- `mpPaymentMethodId` (ej: `visa`, `mastercard`, `account_money`)
- `mpPaymentType` (ej: `credit_card`, `debit_card`, `bank_transfer`)
- `mpCardLastFour` (últimos 4 dígitos de tarjeta, NO sensible según PCI DSS)
- `mpInstallments`
- `mpTransactionAmount` (gross, lo que pagó el cliente)
- `mpNetReceivedAmount` (lo que recibió el owner después de comisión)
- `mpFeeAmount` (comisión MP)
- `mpDateCreated` (cuándo se creó el pago en MP)

### Issue 2 — Generar PDF "Comprobante RentalPro"
Server action que arma un PDF con:
- Header RentalPro (logo + nombre del owner)
- Datos del pago (monto, fecha, status)
- Datos de MP (último 4 de tarjeta, método, comisión, neto)
- Datos de la reserva (propiedad, cliente, fechas, noches)
- Sello "Comprobante interno — generado por RentalPro" (no es comprobante fiscal de MP)

Guardarlo en **Supabase Storage** (path: `payments/{paymentId}/receipt-{timestamp}.pdf`). Botón "Descargar comprobante" en `payment-row-actions.tsx`, visible cuando `method === MERCADO_PAGO` y `status === COMPLETED`.

## User Stories

### Issue 1 — Persistir metadata

1. Como owner, quiero ver los últimos 4 dígitos de la tarjeta con la que se pagó, para validar que coincide con lo que el cliente me dijo.
2. Como owner, quiero ver el monto exacto que se acreditó después de la comisión de MP, para conciliar con mi extracto bancario.
3. Como owner, quiero ver el monto de comisión que MP cobró, para entender mis márgenes reales.
4. Como owner, quiero ver el método de pago exacto (`visa`, `mastercard`, `account_money`), no solo "tarjeta", para mejor auditoría.
5. Como owner, quiero ver la fecha exacta de aprobación de MP (`date_approved`), no solo cuándo mi webhook la recibió.
6. Como owner, quiero ver el `paymentId` numérico de MP (no el preference_id), para tener una referencia cruzada directa con la consola de Mercado Pago.
7. Como owner, quiero ver cuántas cuotas se pagaron (`installments`), para registrar pagos en cuotas.
8. Como developer, quiero que el seam `markPaymentCompleted` acepte los nuevos campos sin romper compatibilidad con llamadas existentes.
9. Como developer, quiero que el guardado de metadata sea idempotente (recibir el mismo webhook dos veces no duplica ni pisa datos válidos).

### Issue 2 — PDF

10. Como owner, quiero descargar un PDF del comprobante de pago de Mercado Pago, para adjuntarlo a mi archivo contable o enviarlo al cliente.
11. Como owner, quiero que el PDF incluya la info de la reserva asociada (propiedad, cliente, fechas), para no tener que cruzar manualmente.
12. Como owner, quiero que el PDF mencione explícitamente "comprobante interno RentalPro" y no se confunda con un comprobante fiscal oficial de MP.
13. Como owner, quiero que el PDF esté disponible solo para pagos COMPLETED de Mercado Pago, no para pagos pendientes o fallidos.
14. Como owner, quiero que el PDF se hospede en Supabase Storage y sea recuperable aunque cierre el navegador.
15. Como owner, quiero ver en la tabla de pagos un botón "Descargar comprobante PDF" claramente distinguible del actual "Ver comprobante" (que muestra la imagen subida manualmente).

## Implementation Decisions

**Schema (`prisma/schema.prisma` — `Payment` model):**
- Nuevos campos nullable (todos):
  - `mpPaymentId String? @unique`
  - `mpStatusDetail String?`
  - `mpPaymentMethodId String?`
  - `mpPaymentType String?`
  - `mpCardLastFour String?`
  - `mpInstallments Int?`
  - `mpTransactionAmount Decimal?`
  - `mpNetReceivedAmount Decimal?`
  - `mpFeeAmount Decimal?`
  - `mpDateCreated DateTime?`
- Migración no destructiva (todos nullable, sin defaults, backfill nullable).

**Webhook route (`route.ts`):**
- Ampliar la función local `getPaymentStatus` (líneas 121-150) para que capture del response de MP: `id`, `status_detail`, `payment_method_id`, `payment_type`, `card.last_four_digits`, `installments`, `transaction_amount`, `net_received_amount`, `fee_details`, `date_created`. Devuelve un tipo extendido.
- Pasar el objeto ampliado a `processMercadoPagoWebhook`.

**Webhooks + payments seam:**
- Extender `processMercadoPagoWebhook` en `src/lib/actions/payments.ts:440` para aceptar los nuevos campos del pago.
- Usar `markPaymentCompleted` extendido (ver más abajo) para persistir. Si el pago ya estaba en estado terminal (idempotencia), no pisa `paidAt`.
- Backfill opcional: NO se hace en esta iteración (payasos viejos quedan sin metadata; es aceptable para auditorías futuras).

**Seam canónico `src/lib/payments/queries.ts`:**
- Extender `markPaymentCompleted` con un nuevo campo `mpMetadata?: { ... }` opcional.
- Agregar helper nuevo `getPaymentReceiptData(paymentId)` que carga `Payment` + `Reservation` + `ReservationClient` + `Property` con selects optimizados para el PDF (evitar N+1).
- Patrón: signature `(paymentId, adapter = prisma)` igual que los demás helpers del archivo.

**Storage (`@supabase/supabase-js`):**
- Bucket existente `documents` (referenciado en `CONTEXT.md:115` como "PDFs y documentos → Supabase Storage").
- Path por pago: `payments/{paymentId}/receipt-{ISO_timestamp}.pdf`.

**PDF — nueva server action (`src/app/api/payments/[id]/receipt/route.ts`):**
- Método: `GET`.
- Auth: valida sesión del owner + que `payment.reservation.userId === session.userId`.
- Si pago no COMPLETED o `method !== MERCADO_PAGO` → 400.
- Llamar helper `getPaymentReceiptData(id)`.
- Renderizar con `@react-pdf/renderer` (server side).
- Sube a Supabase Storage con upsert filename `{paymentId}-{paidAt unix}.pdf`.
- Redirige a la URL firmada (`createSignedUrl`) — UX: el botón es un link directo a este endpoint, el browser descarga.
- Si ya existe PDF → devuelve el existente (no regenera).

**Componente PDF (`src/lib/payments/receipt-pdf.tsx`):**
- Componente React puro: `<PaymentReceipt payment={...}/>`.
- Una sola página A4. Estilos tipográficos para legibilidad / impresión.
- Campos mostrados: header, sección "Pago" (monto, status, fecha aprobación), sección "Mercado Pago" (último 4, método, comisión, neto), sección "Reserva" (propiedad, cliente, fechas, noches calculadas), footer con disclaimer.

**UI (`src/components/payments/payment-row-actions.tsx`):**
- Nueva acción "Descargar comprobante" — visible solo si `method === MERCADO_PAGO` y `status === COMPLETED`.
- Equilibrio de prioridad con Ver comprobante (imagen subida): "Descargar comprobante MP" es acción primaria cuando existe, sino se muestra como menú contextual.
- Sin cambio de `compact: boolean` (aplica igual en modal).

**Manifest:**
- `"@react-pdf/renderer": "^x.y.z"` en `package.json`. Sin otras deps nuevas.

**Seguridad / PCI:**
- Guardamos `mpCardLastFour` en claro (NO sensible según PCI DSS — son los últimos 4 dígitos, info ya visible al owner en su dashboard de MP).
- NO guardamos `cardholder.name`, `first_six_digits`, ni CVV.
- Documentado en ADR-0026 (ver further notes).

## Testing Decisions

**Patrón:** tests unitarios para los seams, tests de integración para el flujo end-to-end del PDF.

**Tests a escribir:**

1. `getPaymentStatus` ampliado — capturar correctamente campos del mock JSON de MP (fixture).
2. `processMercadoPagoWebhook` — acepta y persiste la nueva metadata con `markPaymentCompleted` extendido (mockeando).
3. `markPaymentCompleted` extendido — pasa solo los campos definidos (los undefined no se pisan).
4. `getPaymentReceiptData` — selects correctos, null guards, formato fechas.
5. `PaymentReceipt` (rendering) — snapshot test del PDF o comparar bytes con fixture (acepta snapshot binario).
6. API route `/api/payments/[id]/receipt`:
   - 401 si no hay sesión.
   - 403 si la reserva no pertenece al owner.
   - 400 si pago no es COMPLETED o no es MP.
   - 200 con Location header a signed URL para happy path.
   - Idempotencia: segunda llamada no regenera.

**Prior art:**
- `src/lib/actions/__tests__/payments.test.ts` (existente, 2300+ líneas) — sigue el patrón `vi.mock('@/lib/db/prisma')` + `vi.mocked(getMercadoPagoToken)`.
- `src/lib/payments/__tests__/queries.test.ts` — patrón seam canónico.
- Para PDF sin cobertura previa: prior art = `@react-pdf/renderer` docs y patrones de Next.js server-side render con Response.

## Out of Scope

- Generación **automática** del PDF al completarse el pago (email/webhook) — Issue 2 lo deja como descarga bajo demanda del owner.
- Comprobantes para pagos CASH / TRANSFER (siguen subiendo imagen manualmente como hoy).
- Multi-idioma del PDF (solo español por ahora).
- Branding configurable por owner (logo y color fijos del sistema).
- Encriptación de `mpCardLastFour` en DB (decisión: no encriptar, ver ADR).
- Generación de comprobantes fiscales oficiales (factura electrónica) — eso es legislación local fuera del scope de RentalPro.
- Permitir al cliente descargar el PDF (Issue 2 es owner-only).

## Further Notes

**ADR a crear** (Issue 1 entrega):
- `docs/adr/0026-mp-payment-metadata-storage.md` documenta:
  - Campos capturados, justificación por campo.
  - Decisión de NO encriptar `mpCardLastFour` (referencia a PCI DSS scope).
  - Backfill: NO se hace (pagos viejos quedan sin metadata; es aceptable para auditoría histórica).
  - Idempotencia del webhook.

**Releases:**
- Issue 1 va primero. Una vez merged y deployado, se ejecuta en producción un re-fetch manual de los últimos N pagos (script one-off) si se considera necesario. NO incluido en este PRD.
- Issue 2 depende de Issue 1 (sin los campos, no hay PDF útil).

**Métricas esperadas:**
- Issue 1: cero impacto en latencia del webhook (mismo fetch, solo más campos leídos).
- Issue 2: latency del endpoint ~300-500ms (render + upload a Supabase Storage).

## Issues Relacionados

Creadas en GitHub tracker (2026-07-17), todas `ready-for-agent`:

- **#183** — DB: Migración Payment con nuevos campos MP metadata (sin blockers)
- **#184** — Webhook/gateway: Capturar y persistir MP metadata (blocked by #183)
- **#185** — UI + API: Descargar comprobante PDF de pago MP (blocked by #183, #184)

ADR-0026 (decisión de no encriptar `mpCardLastFour`) está implícito como parte de #183.
