> **STATUS: ARCHIVADO (2026-07-14).** Este handoff describía 214 errores / 85 warnings detectados tras la migración a Next 16 (sesión previa).
>
> **Estado real al archivar:** 0 errores, 476 warnings (en 350 archivos, mayoritariamente `@typescript-eslint/no-explicit-any` y `@typescript-eslint/no-unused-vars`).
>
> **Cierre de errores:** todos los errores P0–P3 (incluyendo `react-hooks/rules-of-hooks`, `react-hooks/immutability`, `react/no-children-prop`, `@typescript-eslint/ban-ts-comment`, `prefer-const`, `react-hooks/set-state-in-effect`) fueron resueltos en commits del **perf audit 2026-07-12** y del commit de cierre `58407a9 fix(lint): cierra 3 errores restantes del perf audit`.
>
> **Warnings restantes:** decisión de backlog. El usuario prefirió primero cerrar perf audit y limpiar ruido documental antes de tacklearlos. Ver `CONTEXT.md` → sección "Estado del proyecto / Backlog activo" para el plan propuesto.
>
> **No usar como guía de implementación:** los conteos, distribución por regla y top 10 archivos de este documento son del estado de captura original y NO reflejan el código actual.

---

# Handoff: Resolver la deuda de lint detectada por la migración a Next 16

## Goal

Llevar `npm run lint` a 0 errores y 0 warnings sin introducir regresiones en
typecheck, tests ni comportamiento de la app. Hoy detecta **214 errores y 85
warnings** distribuidos en 186 archivos.

## Contexto de la migración (NO revertir)

- Next 16.2.7 eliminó `next lint`. El script ahora es `eslint .` y la flat
  config está en `eslint.config.mjs`.
- La flat config importa directo las configs planas oficiales de
  `eslint-config-next@16.2.7`:
  - `eslint-config-next/core-web-vitals`
  - `eslint-config-next/typescript`
- Se ignora explícitamente: `.next/**`, `node_modules/**`, `out/**`,
  `build/**`, `next-env.d.ts`, `.agents/**`, `.opencode/**`.
- El usuario eligió la opción "Solo dejar lint funcional y reportar" en la
  sesión anterior. **No se tocó código de la app en esa sesión.** Esta
  limpieza es un PR dedicado.

## Estado verificable

```bash
npm run typecheck        # 0 errores
npm run test:run         # 51/51 pasan en payments + reservation-detail-dialog
npm run lint             # 214 errors, 85 warnings
```

Captura completa del último lint en JSON:
`C:\Users\eduri\AppData\Local\Temp\opencode\lint-report.json` (se puede
regenerar con `npx eslint . --format json > lint-report.json`).

## Distribución por regla

| Count | Severity | Rule |
|------:|----------|------|
| 193   | error    | `@typescript-eslint/no-explicit-any` |
|  67   | warn     | `@typescript-eslint/no-unused-vars` |
|  12   | error    | `react-hooks/set-state-in-effect` |
|   8   | warn     | `react-hooks/exhaustive-deps` |
|   5   | warn     | `@next/next/no-img-element` |
|   3   | warn     | `react-hooks/incompatible-library` |
|   3   | error    | `@typescript-eslint/ban-ts-comment` |
|   2   | error    | `react-hooks/rules-of-hooks` |
|   2   | error    | `react/no-children-prop` |
|   2   | warn     | `import/no-anonymous-default-export` |
|   1   | error    | `prefer-const` |
|   1   | error    | `react-hooks/immutability` |

## Top 10 archivos por cantidad de problemas

| Count | File |
|------:|------|
| 68    | `src/lib/actions/__tests__/payments.test.ts` |
| 26    | `src/lib/actions/__tests__/reservations.test.ts` |
| 25    | `src/lib/payment/__tests__/gateway.test.ts` |
| 22    | `src/components/reservations/reservation-table.tsx` |
| 13    | `src/components/reservations/reservation-detail-dialog.tsx` |
| 11    | `src/lib/actions/reservations.ts` |
| 10    | `src/lib/actions/payments.ts` |
| 10    | `src/components/calendar/calendar-timeline.tsx` |
|  8    | `src/lib/payments/__tests__/monthly.test.ts` |
|  7    | `src/app/(dashboard)/reports/page.tsx` |

## Prioridad sugerida (de mayor impacto a menor)

### P0 — Bugs reales, no solo estilo

1. **`react-hooks/rules-of-hooks` (2 errors)** en
   `src/components/reservations/send-payment-link-dialog.tsx:111` y `:124`.
   Son hooks llamados después de un `early return`. Revisar el componente
   completo y mover los hooks al inicio.

2. **`react-hooks/immutability` (1 error)**: buscar el archivo concreto con
   `npx eslint . -r "react-hooks/immutability"` y corregir la mutación
   directa del estado.

3. **`react/no-children-prop` (2 errors)**: niños pasados como prop en
   lugar de `children`. Cambiar a `<Comp>{x}</Comp>`.

4. **`@typescript-eslint/ban-ts-comment` (3 errors)** en `payments.test.ts`,
   `gateway.test.ts`, `reservation-payment.test.ts`. Tienen
   `// @ts-nocheck`. Reemplazar por tipos correctos o usar `// @ts-expect-error`
   con motivo.

5. **`prefer-const` (1 error)** en `src/lib/actions/reservations.ts:384`:
   cambiar `let startDate` a `const` (auto-fixeable con `--fix`).

### P1 — `no-explicit-any` (193 errores, ~90% del total)

Concentración:

- `src/lib/actions/__tests__/payments.test.ts` (68)
- `src/lib/actions/__tests__/reservations.test.ts` (26)
- `src/lib/payment/__tests__/gateway.test.ts` (25)
- `src/lib/actions/reservations.ts`, `payments.ts`, `clients.ts`,
  `properties.ts`, `reports.ts`, `super-admin.ts` (~50 en total)
- `src/lib/export-utils/pdf.ts`, `src/components/reservations/send-payment-link-dialog.tsx`,
  `src/components/properties/property-form.tsx`, `property-form-sections.tsx`,
  `src/components/properties/properties-client.tsx`,
  `src/lib/actions/__tests__/clients.test.ts`, `__tests__/cloudinary.test.ts`,
  `__tests__/mercado-pago.test.ts`, `__tests__/reservation-documents.test.ts`,
  `__tests__/reservations-pagination.test.ts`,
  `src/lib/payments/__tests__/monthly.test.ts`
- `src/lib/actions/__tests__/payments.test.ts:1` ya tiene `@ts-nocheck`
  (entraría en el cleanup del P0).

Decisión que el usuario debe ratificar (preguntar al inicio):

- **A — Refactorizar a tipos concretos**: 193 sitios. Trabajo grande, pero
  deja la base tipada de verdad. Empezar por `lib/actions/**` (no tests) y
  dejar tests para el final con overrides.
- **B — Relajar a `warn` en `eslint.config.mjs`**: cambio de 3 líneas,
  cero código tocado, sigue exponiendo los sitios para refactor futuro.
  Adecuado si la prioridad es bajar deuda de CI rápido.
- **C — Override por directorio**: tests con regla a `warn` y código de
  app con `error`. Compromiso común.

Recomendación: **A por fases**, archivo por archivo de producción primero
(`lib/actions/*.ts` no tests, `components/**/*.tsx` no tests), y al final
plantear B o override para los tests si la presión de tiempo es real.

### P2 — `no-unused-vars` (67 warnings)

Triviales. Muchos imports o handlers quedaron sin uso. Auto-fixeable no,
pero se puede automatizar con `eslint . --fix --rule
'@typescript-eslint/no-unused-vars: warn'` y revisión manual. Convención del
proyecto: imports se eliminan, no se prefijan con `_`.

### P3 — `react-hooks/set-state-in-effect` (12 errors)

Patrón típico `useEffect(() => setMounted(true), [])` para evitar
hydration mismatch. Aparece en:

- `src/components/layout/dashboard-layout-client.tsx:32`
- `src/components/layout/dashboard-navbar.tsx:33`
- `src/components/reservations/reservations-list-client.tsx:154, 161, 198`
- `src/components/reservations/reservation-documents-panel.tsx:52`
- `src/hooks/use-pagination.ts:27`
- otros

Decisión técnica: el patrón es legítimo en este proyecto (Next.js con
SSR). Dos opciones:

- Suprimir con `// eslint-disable-next-line react-hooks/set-state-in-effect`
  y comentario explicando el motivo (hydration safety).
- Refactorizar usando `useSyncExternalStore` o marcadores client-only.

Recomendación: suprimir con comentario en los 12 sitios. Es un patrón
aceptado y no es un bug.

### P4 — `react-hooks/exhaustive-deps` (8) y `incompatible-library` (3)

Revisar y corregir según el caso. `exhaustive-deps` suele ser trivial
añadir la dependencia o usar `useCallback`/`useMemo`. `incompatible-library`
es sobre `react-hook-form` (`watch()` no es memoizable) — suele
resolverse usando `useWatch` en su lugar.

### P5 — `@next/next/no-img-element` (5)

Cambiar `<img>` por `<Image>` de `next/image`. Pasa por alto `src/components/ui/receipt-upload.tsx`
y `components/properties/property-form*.tsx`.

### P6 — `import/no-anonymous-default-export` (2)

Cambiar `export default function() {}` por `export default function
Nombre() {}`.

## Comandos útiles

```bash
# Inventario por regla
npx eslint . --format json | jq '[.[].messages[].ruleId] | group_by(.) | map({rule: .[0], count: length}) | sort_by(-.count)'

# Sólo errores
npx eslint . --quiet

# Auto-fix (cubre prefer-const y formateos)
npx eslint . --fix

# Sólo un archivo
npx eslint src/lib/actions/reservations.ts

# Sólo una regla
npx eslint . --rule '{"@typescript-eslint/no-explicit-any": ["error"]}'
```

## Skills a usar

- **`improve-codebase-architecture`** si la limpieza de `no-explicit-any`
  requiere diseño (p. ej. un wrapper genérico para respuestas de MP).
- **`diagnose`** si aparecen tests rotos al tocar archivos con muchos
  cambios.
- **`next-best-practices`** al tocar `reservation-detail-dialog.tsx`,
  `reservations-list-client.tsx` y `use-pagination.ts` (los hooks set-state
  viven en componentes client).
- **`react-hook-form`** para los 3 warnings de `incompatible-library`.

## Archivos que YA tienen cambios sin commit

Solo por awareness, no revertir:

- `src/components/reservations/reservation-detail-dialog.tsx`
- `src/components/reservations/reservations-list-client.tsx`
- `src/components/reservations/__tests__/reservation-detail-dialog.test.tsx`
- `src/app/(dashboard)/dashboard/page.tsx` (fix de `data.reservations.filter`)
- `eslint.config.mjs` (migración Next 16)
- `package.json` (script `lint`)
- `src/components/calendar/calendar-grid.tsx` (cambios visuales no
  relacionados con lint)

Estos pueden contaminar el output de `git diff` durante el cleanup. Si
arrancas PR limpio, sugiere stashear antes de empezar.

## Definition of Done

- [ ] `npm run lint` → 0 problemas.
- [ ] `npm run typecheck` → 0 errores.
- [ ] `npm run test:run` → todos los tests pasan.
- [ ] PR con descripción que liste las decisiones por regla (sobre todo
  si hubo overrides en `eslint.config.mjs`).
- [ ] Ningún cambio a `eslint.config.mjs` salvo acordados con el usuario.
