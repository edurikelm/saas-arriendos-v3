---
name: RentalPro
description: SaaS B2B de gestión de arriendos para property managers en LATAM

colors:
  # Primary
  verdigris: "oklch(0.7227 0.1920 149.5793)"
  verdigris-deep: "#2DBE85"

  # Semantic
  calm-sea: "oklch(0.65 0.16 150)"
  amber-hour: "oklch(0.78 0.16 75)"
  coastal-mist: "oklch(0.65 0.13 200)"
  coral-warning: "oklch(0.6368 0.2078 25.3313)"

  # Neutral — Foreground
  deep-tide: "#131f1a"

  # Neutral — Background
  sea-glass: "oklch(0.978 0.004 160)"
  midnight-harbor: "#051424"

  # Neutral — Card / Surface
  white-sail: "oklch(1.0000 0 0)"
  hull-dark: "#0d1c2d"

  # Neutral — Muted
  driftwood: "oklch(0.9670 0.0029 264.5419)"
  slate-whisper: "#64748b"

  # Border
  sea-mist: "oklch(0.9276 0.0058 264.5313)"

  # Accent
  mint-light: "oklch(0.9505 0.0507 163.0508)"

  # Project-specific
  sand: "oklch(0.97 0.02 200)"
  deep-lagoon: "oklch(0.72 0.15 195)"

typography:
  display:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
    letterSpacing: "0.05em"
    textTransform: "uppercase"
  mono:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 400

rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"

components:
  button-primary:
    backgroundColor: "{colors.verdigris}"
    textColor: "{colors.white-sail}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.deep-tide}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.deep-tide}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-destructive:
    backgroundColor: "{colors.coral-warning}"
    textColor: "{colors.white-sail}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  card-default:
    backgroundColor: "{colors.white-sail}"
    rounded: "{rounded.xl}"
    padding: "16px"
  card-sm:
    backgroundColor: "{colors.white-sail}"
    rounded: "{rounded.lg}"
    padding: "12px"
  badge-default:
    backgroundColor: "{colors.driftwood}"
    textColor: "{colors.deep-tide}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-success:
    backgroundColor: "{colors.calm-sea}"
    textColor: "{colors.white-sail}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-warning:
    backgroundColor: "{colors.amber-hour}"
    textColor: "{colors.white-sail}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-info:
    backgroundColor: "{colors.coastal-mist}"
    textColor: "{colors.white-sail}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-destructive:
    backgroundColor: "{colors.coral-warning}"
    textColor: "{colors.white-sail}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.deep-tide}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
  kpi-card:
    backgroundColor: "{colors.white-sail}"
    rounded: "{rounded.lg}"
    padding: "16px"
  data-table:
    backgroundColor: "{colors.white-sail}"
    rounded: "{rounded.md}"
    padding: "0"
  filter-pill-active:
    backgroundColor: "{colors.verdigris}"
    textColor: "{colors.white-sail}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  filter-pill-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.slate-whisper}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  reservation-pill-success:
    backgroundColor: "{colors.calm-sea}"
    textColor: "{colors.deep-tide}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  dialog-content:
    backgroundColor: "{colors.white-sail}"
    textColor: "{colors.deep-tide}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: RentalPro

## Overview

**Creative North Star: "The Working Harbor"**

RentalPro no es una app turística ni una vitrina de marketing. Es el puerto operativo donde un property manager en LATAM llega cada mañana a revisar qué barcos (reservas) zarpan hoy, qué muelles (propiedades) están libres, qué contenedores (pagos) siguen sin cobrar y qué merece atención antes de que el día se descontrole. La identidad visual nace de esa metáfora: agua en reposo, manifests en lugar de fuegos artificiales, equipo de navegación confiable en lugar de gadgets decorativos.

El sistema se llama **Ocean Breeze** porque comparte dos cosas con la brisa marina: presencia constante sin estridencia, y la cualidad de hacer que un espacio denso se sienta aireado. La paleta dominante es **Verdigris** — un verde-teal ligeramente desplazado hacia el verde puro (`hue 149.58°`), no un cyan frío. Esa decisión importa: Verde-azul frío gritaría "tech"; el matiz cálido hacia verde respira "operación de confianza, dinero que entra, equilibrio de cuenta". Es el color de la moneda en una libreta, no de un dashboard de trading.

La jerarquía no se gana con sombras. Se gana con **dos píxeles de acento** (`border-t-2 border-t-primary` en cada tabla), **diez píxeles de whisper** (`text-[10px] font-bold uppercase tracking-wider` en cada label), y **números tabulares** (`tabular-nums` en cada KPI). El sistema es plano por defecto — las superficies flotantes (Dialog, Dropdown, Tooltip) son las únicas que se levantan. Esto invierte la jerarquía tradicional de SaaS: en vez de "todo tiene shadow suave", el producto dice "todo reposa, lo urgente emerge".

El modo de la app es **Operate**. No persuade, no entretiene, no educa — opera. El visitante abre la app para actuar: cobrar, cancelar, registrar, revisar. Cada decisión de diseño prioriza escaneabilidad sobre expresión. La marca vive en detalles precisos, no en饰面装饰. Esta es la decisión fundacional y es no-negociable.

**Key Characteristics:**
- **Plano por defecto, flotante solo cuando emerge.** Las superficies en reposo usan `ring-1 ring-foreground/10` o `border-b`. Las sombras son prerrogativa de Dialog, Dropdown y similares.
- **Verdigris como canal de navegación.** El verde-teal aparece en active states, KPIs primarios, accent strip de tablas, y nunca como decoración ambiental. Su rareza es el punto.
- **Status como lenguaje completo.** Cada estado del dominio (CONFIRMED, VENCIDO, COBRADO, CANCELLED) tiene un token semántico dedicado. La UI nunca adivina: usa `success`/`warning`/`info`/`destructive` por mapeo de dominio, no por estética.
- **10px whisper para labels.** DataTable headers, KpiCard labels, filter pills y reservation pills usan el mismo micro-ritmo tipográfico. Esa repetición es la firma.
- **Números tabulares siempre.** Cualquier cifra (monto, fecha, contador, porcentaje) usa `tabular-nums`. Las cifras no deberían "respirar" entre renders.
- **Mobile-first en modales, desktop-first en densidad.** Modales son `w-[95vw]` para asegurar legibilidad en mobile; tablas son densas en desktop y scrolleables horizontalmente.

---

## Colors

La paleta es de baja saturación en neutros (gris-verdoso apenas perceptible, no gris puro) y saturación media-alta en el eje semántico. La excepción es el eje de marca (Verdigris), que es deliberadamente vivo para que active states destaquen sin gritar. **No hay colores de "data" sueltos** — los charts heredan la rampa teal del primary (`--chart-1` a `--chart-5` son verdes descendientes), no una paleta arcoíris.

### Primary
- **Verdigris** (`oklch(0.7227 0.1920 149.5793)`): Color de marca. Usado en active state del sidebar owner, accent strip superior de tablas (`border-t-2`), icon container de KpiCard primario, fondo de filter pills activos, texto de link primario. **Su rol es señalar navegación activa y resultado positivo, no decoración.** En dark mode se mantiene como `Verdigris Deep` (`#2DBE85`).

### Semantic
- **Calm Sea** (`oklch(0.65 0.16 150)`): Estado de éxito — reservas CONFIRMED, pagos COMPLETED, KPIs de cobranza ≥85%, sublabel positivo en indicadores.
- **Amber Hour** (`oklch(78% 0.16 75)`): Estado de advertencia — pagos que vencen hoy, reservas con saldo pendiente, KPIs "por cobrar". No es danger; es atención.
- **Coastal Mist** (`oklch(65% 0.13 200)`): Estado informativo — próximos 7 días, próximo check-in, duración DAILY/MONTHLY. Diferencia DAILY vs MONTHLY por label, no por color.
- **Coral Warning** (`oklch(63.68% 0.2078 25.33)`): Estado destructivo — pagos vencidos, reservas CANCELLED, errores, confirmación destructiva. El único color que carga peso emocional.

### Neutral
- **Deep Tide** (`#131f1a`): Foreground canónico en light mode — texto principal. Nunca sobre fondo blanco puro: usar `--card` (que es `--white-sail`) para contraste sutil.
- **Slate Whisper** (`#64748b`): Texto secundario. Iconos inactivos del sidebar, labels de metadata, placeholders. **Nunca para superficies** — solo texto.
- **Sea Glass** (`oklch(97.8% 0.004 160)`): Fondo de página en light mode. Tiene un tinte verde apenas perceptible (no es gris puro) — esa es la firma.
- **Midnight Harbor** (`#051424`): Fondo de página en dark mode. Negro-azul muy oscuro, no negro puro.
- **White Sail** (`oklch(100% 0 0)`): Superficie de card, popover, navbar y sidebar en light mode. Puro blanco sobre fondo `Sea Glass` para jerarquía sin shadow.
- **Hull Dark** (`#0d1c2d`): Superficie de card, popover, navbar y sidebar en dark mode. No negro: azul oscuro de casco de barco.
- **Driftwood** (`oklch(96.7% 0.0029 264.54)`): Superficie muted — `bg-muted`, fondo de tabla headers (`bg-muted/50`), fondo del filter pill container. Para superficies secundarias, no para texto apagado.
- **Sea Mist** (`oklch(92.76% 0.0058 264.53)`): Border canónico. También `--input`. Línea de un píxel, nunca más gruesa; la jerarquía vertical/horizontal se construye con combinaciones de este color, no con grosor.

### Accent
- **Mint Light** (`oklch(95.05% 0.0507 163.05)`): Acento neutral cálido. Active state del sidebar admin, fondo `bg-accent` para hovers en componentes no-primarios. Usar con moderación — su rol es "second voice", no "alternative primary".

### Project-specific
- **Sand** (`oklch(97% 0.02 200)`): Acento neutral cálido (`--beige`). Para zonas que necesitan calidez sin salirse del sistema (e.g., futuras pantallas de marketplace). Sin uso activo hoy; reservado.
- **Deep Lagoon** (`oklch(72% 0.15 195)`): Marca secundaria (`--brand-secondary`). Reservado para diferenciación cuando el contexto lo demande (e.g., badges de plan, comparativas FREE vs PRO). Sin uso activo hoy.

### Named Rules

**The Fill-vs-Text Rule.** Cada tono semántico tiene DOS colores, y no son intercambiables: el de **relleno** (`--success`, `--warning`, `--info`, `--destructive`) para fondos y barras, y el **legible sobre card** (`--success-foreground`, `--warning-foreground`, `--info-foreground`, `--destructive-text`) para texto e íconos. Usar el de relleno como color de texto es el error que produjo #235: `text-destructive` sobre card mide **3.76:1 en claro**, bajo el mínimo AA de 4.5:1, y la excepción de "texto grande" no aplica porque el producto usa 10-12px casi en todas partes. `destructive` es el único tono cuyo compañero legible **no** se llama `*-foreground` — ese nombre ya estaba ocupado por el blanco que va encima del relleno rojo. Valores medidos de `--destructive-text`: **5.34:1 claro / 5.46:1 oscuro** sobre card, y **4.75:1 / 4.90:1** sobre `bg-destructive/10`, que es el combo real del producto y por eso también entra en el criterio.

**The Status Color Doctrine.** Cada estado del dominio se mapea a exactamente un token semántico, sin excepciones: CONFIRMED → `success`, VENCE HOY → `warning`, VENCIDO → `destructive`, próximos 7 días → `info`. La UI no inventa estados intermedios — si la semántica no cabe en los cuatro, se usa `secondary` o `outline`. Esta regla cubre badges, icon containers, KpiCard `tone`, borders de alert-boxes, y color de texto en sublabels. **El `ReservationPill` es la única excepción tipográfica legítima:** usa los mismos tokens pero renderiza como pill inline porque admite sublabel debajo del label principal, lo que `<Badge>` no soporta nativamente.

**The One Focus Ring Rule.** El anillo de foco es **uno solo en todo el producto**: `focus-visible:ring-3 focus-visible:ring-ring/60`, con `--ring` apuntando a `--foreground`. No se tiñe por variante, por tono semántico ni por estado de validez. Medido sobre las superficies reales (`card`, `background`, `muted`, `secondary`, `accent`): **4.24-4.47:1 en claro / 5.99-6.46:1 en oscuro**, sobre el 3:1 que WCAG 1.4.11 pide a un indicador de interfaz.

No es preferencia de estilo, es la única opción que pasa. El teal de marca como anillo mide 2.28:1 opaco en claro y 1.53:1 al 50%, y sobre un botón `bg-primary` el borde de foco queda en 1.00:1 — invisible justo en el control más común. Los tonos semánticos son peores: en claro, `ring-warning` topa en **2.05:1** y `ring-info` en **2.98:1** incluso opacos, así que no hay opacidad que los salve. Por eso las variantes `destructive`/`success`/`warning`/`info` de `<Badge>` y `<Button>` **no** llevan anillo propio.

Corolario sobre el estado inválido: `aria-invalid` se señala **con el borde** (`aria-invalid:border-destructive`, opaco: 3.76:1 claro / 4.57:1 oscuro), nunca reemplazando el anillo de foco. Un anillo `ring-destructive/20` pisaba al de foco y dejaba el campo inválido enfocado en **1.30:1**: el control que más necesita el indicador era el único sin uno válido. Medido en #242.

**The Grouped Status Rule.** Cuando una lista está **agrupada por estado**, el color del estado vive en el encabezado del grupo y **las filas no llevan ninguno**: sin pill, sin monto teñido, sin chip. El encabezado lo dice una vez para todas sus filas. Repetirlo por fila codifica el mismo hecho varias veces en el mismo color y satura la sección sin agregar información — la lista ya está ordenada y agrupada por urgencia, así que el estado de una fila se deduce del grupo que la contiene. Caso canónico: `DashboardCobranzaList` (ver ADR-0033), donde el encabezado lleva `text-destructive-text` o `text-warning-foreground` y cada fila queda en `text-foreground` (monto) + `text-muted-foreground` (metadata). **El monto nunca se tiñe con el color del estado:** es el dato que el usuario compara ENTRE filas, y un monto que cambia de color por fila deja de ser escaneable como columna. El estado de cada fila debe seguir disponible para lectores de pantalla sin depender del encabezado, pero **no vía `aria-label` en el contenedor de la fila**: un `aria-label` reemplaza el contenido interno como nombre accesible en vez de complementarlo, así que se lleva por delante el resto de la fila. La forma correcta —la que usa `DashboardCobranzaList` desde el fix de #237— es un `<span className="sr-only">` con la palabra del estado dentro de la fila.

**The Verdigris Rarity Rule.** Verdigris aparece en ≤10% del área visible de cualquier pantalla. Su función es señalar navegación activa o resultado primario; si ocupa más, deja de señalar y empieza a decorar. Los `bg-primary/10` y `text-primary` para active state son la única excepción a esta regla de rareza — el 10% sigue siendo rareza cuando el fondo apenas se ve.

---

## Typography

**Display Font:** DM Sans (with `sans-serif` fallback)
**Body Font:** DM Sans (with `sans-serif` fallback) — DM Sans cubre todos los pesos de la jerarquía
**Label/Mono Font:** IBM Plex Mono (preloaded, sin uso activo hoy; reservado para IDs técnicos, tokens, hashes de receipt)

### Hierarchy

- **Display** (`font-weight: 700`, `text-xl` a `text-3xl` según Tier, `leading-tight`): Títulos de página (`<h1>`). Tres tiers explícitos: Tier 1 `text-xl font-bold` para páginas data-heavy (dashboard, payments, clients); Tier 2 `text-2xl sm:text-3xl font-bold tracking-tight` para settings y detail; Tier 3 `text-3xl font-bold` para forms donde el form es la hero.
- **Headline** (`font-weight: 500`, `text-lg`, `leading-snug`): Títulos de sección (`<h2>`) dentro de una página. Separadores entre bloques.
- **Title** (`font-weight: 500`, `text-base` o `text-sm` para cards compactas): Títulos de card, headers de modal, labels de field group.
- **Body** (`font-weight: 400`, `text-sm`, `leading-normal`): Texto corrido por defecto. Tabla body usa `text-xs` para densidad.
- **Label** (`font-weight: 700`, `text-[10px]`, `letter-spacing: 0.05em`, `text-transform: uppercase`): El "10px whisper". Headers de DataTable, KpiCard labels, filter pills, ReservationPill labels, eyebrow text del navbar. Es la firma tipográfica unificadora — ver Named Rules.
- **Mono** (`font-weight: 400`, `text-xs`, `IBM Plex Mono`): IDs de reserva, hashes de receipt, importes en contexto técnico. **Hoy sin uso activo en producto** — precargado vía `next/font/google` para evitar flash si se introduce.

### Named Rules

**The 10px Whisper Rule.** Toda label, header de tabla, KPI label y pill activo/inactivo usa `text-[10px] font-bold uppercase tracking-wider` (con variantes `text-muted-foreground` para apagado y `text-primary-foreground` para activo). Es el único patrón tipográfico que se repite en 4+ primitives. Su función: comprimir metadata al tamaño más pequeño legible sin sacrificar escaneabilidad, porque el uppercase + tracking-wider aumenta perceptivamente la altura de x. **No usar este patrón en contenido corrido** — para párrafos, body.

**The Tabular Truth Rule.** Cualquier cifra (monto en CLP, contador de reservas, porcentaje de ocupación, fecha absoluta corta) lleva `tabular-nums`. Las cifras alineadas verticalmente son la base de la sensación "tabla de cuentas" — sin esto, los números bailan entre renders y la confianza visual se rompe. Aplicar a `<td>` con datos numéricos, `<KpiCard value>`, y `text-foreground/70 text-xs font-mono` cuando la cifra es técnica (ID, hash).

**The Two-Tier Heading Rule.** Los `<h1>` cambian de tamaño según la densidad del contenido de la página, no según el dispositivo. La regla implícita es: cuando el dato es la hero (tabla densa, lista, KPIs), el h1 compite visualmente con el `<KpiCard>` (también `text-xl font-bold tabular-nums`). Cuando la página tiene más aire (forms, settings, detail), el h1 puede crecer. Esta es una decisión de peso visual, no de responsive.

---

## Layout

El sistema es **desktop-first en densidad, mobile-first en modales**. Las vistas de producto asumen ≥1024px para layouts de 2-3 columnas (KPIs grid, listas+detail); mobile colapsa a 1 columna pero preserva la jerarquía. Los modales son universales: `w-[95vw]` con `max-w-*` desktop.

### Grid & Container

| Property | Value |
|----------|-------|
| Page padding (mobile) | `p-4` (16px) |
| Page padding (desktop ≥640px) | `p-6` (24px) |
| Content max-width | Sin límite (full width, dashboard pattern) |
| Card grid (KPIs / lists) | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` o `lg:grid-cols-4` para KPI rows |
| Gap entre cards | `gap-4 lg:gap-6` (16px mobile, 24px desktop) |
| Gap entre sections | `gap-6` (24px) |
| Gap entre elements | `gap-2` (8px) |

### Sidebar

Layout estructural compartido por owner y admin:

| Property | Value |
|----------|-------|
| Width (expandido) | `w-64` (256px) |
| Width (admin colapsado) | `lg:w-16` (64px) |
| Background | `bg-sidebar` — token propio, NO hardcoded slate/white |
| Border | `border-r border-sidebar-border` |
| Logo div | `h-16 flex items-center px-6 border-b border-border` |
| Nav item | `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors` |
| Hover bg | `hover:bg-muted` (gris neutral, **no tinte teal**) |
| Icon size | `h-5 w-5` (20px) para nav; `h-4 w-4` (16px) para iconos auxiliares |

Active state del owner sidebar: `bg-primary/10 text-primary font-medium` (teal al 10% con texto teal). El admin usa `bg-sidebar-accent text-sidebar-accent-foreground font-medium` (pale mint con texto oscuro). Son dos patrones intencionales, no drift — el owner prioriza el canal de marca, el admin prioriza neutralidad.

User footer del sidebar (avatar + nombre + rol/plan + trigger ⋮ → dropdown): avatar `h-8 w-8 rounded-full bg-muted border border-border`, contenido interior `bg-primary text-primary-foreground` (owner) o `bg-sidebar-accent text-sidebar-accent-foreground` (admin). Trigger `p-1 text-muted-foreground/60 hover:text-foreground`. El theme picker (Claro / Oscuro / Sistema) vive exclusivamente aquí — NO en navbar.

### Navbar

| Property | Value |
|----------|-------|
| Height | `h-16` (64px) |
| Border | `border-b border-border` (sin shadow) |
| Background | `bg-navbar` — token propio, distinto del fondo de página |
| Sticky | `sticky top-0 z-30` |
| Padding | `px-6` |
| Eyebrow text | `text-xs text-muted-foreground font-medium uppercase tracking-wider` |
| Search | `bg-background border-none rounded py-1.5 pl-9 pr-4 text-xs w-64` |

### Responsive Breakpoints

| Breakpoint | Value | Uso |
|------------|-------|-----|
| `sm` | 640px | Sidebar fixed→relative, tablas 2 columnas |
| `md` | 768px | Forms 2 columnas |
| `lg` | 1024px | Sidebar siempre visible, layouts de 3 columnas, KPI grids 4-up |
| `xl` | 1280px | Disponible, sin uso específico |
| `2xl` | 1536px | Disponible, sin uso específico |

---

## Elevation & Depth

El producto es **plano por defecto**. La jerarquía se construye con bordes (`border`, `border-b`, `ring-1 ring-foreground/10`), con `bg-muted` para superficies secundarias, y con el `border-t-2 border-t-primary` que sirve de acento de marca en cada tabla. Las sombras (`shadow-*`) son **prerrogativa exclusiva de superficies flotantes** — el resto usa el lenguaje plano.

### Shadow Vocabulary (producto)

Las sombras permitidas en producto son solo estas, en estos contextos:

- **Floating dialog** (`shadow-lg`): `DialogContent` — único shadow autorizado para modales.
- **Dropdown/Popover** (`shadow-md`): `DropdownMenuContent`, `PopoverContent` — feedback de "emergió del fondo".
- **Tooltip** (shadow sutil propio del primitive): `TooltipContent`.
- **Sheet** (`shadow-lg`): `SheetContent` (primitive no creado aún; reservado para futura implementación).
- **Property card hover** (`hover:shadow-lg`): Excepción consciente en `property-card.tsx` cuando hay imagen. **Solo con imagen** — sin imagen, `hover:ring-primary/50` mantiene el lenguaje plano.

### Marketing Surfaces (excepción consciente)

Las páginas de marketing (`landing-page.tsx`, `pricing-page.tsx`) usan `shadow-lg`, `shadow-2xl`, y `shadow-primary/20` como estética deliberada. **Estas son superficies de persuasión**, no de operación, y tienen permiso de elevación completa. No generalizar al producto.

### Named Rules

**The Calm Water Rule.** Las superficies en reposo son planas — sin shadow, sin glow, sin gradient. La jerarquía se gana con `border` (1px, color `Sea Mist`), `bg-muted` (superficies secundarias), `ring-1 ring-foreground/10` (sobre card), o el `border-t-2 border-t-primary` que es la firma. Un shadow aparece solo cuando una superficie emerge (Dialog, Dropdown, Tooltip, Sheet) o cuando el usuario interactúa (`hover:shadow-lg` en property card con imagen). **No se introduce shadow decorativo en producto nuevo.**

**The Marketing/Product Split.** Las superficies de marketing (landing, pricing) y las de producto (dashboard, listas, formularios, settings) tienen reglas distintas. Marketing puede usar sombras libremente como vehículo persuasivo. Producto debe permanecer plano salvo en componentes flotantes. Esta es la única excepción consciente al `The Calm Water Rule` y aplica solo a las páginas públicas de captación.

---

## Shapes

El lenguaje de formas es **radios suaves y bordes finos**. No hay bordes gruesos, no hay esquinas vivas, no hay formas con filo. Las únicas formas "completas" son pills (filter pills, badges con `rounded-full`) y avatares circulares.

### Radius Scale

| Token | Value | Uso |
|-------|-------|-----|
| `--radius-sm` | 4px | Badges con `rounded-md` (per primitive), reservation pills |
| `--radius-md` | 6px | Buttons size `sm`, inputs |
| `--radius-lg` | 8px (default) | Buttons default, `<KpiCard>`, settings cards |
| `--radius-xl` | 12px | `<Card>` primitive default, modales, dialog content |
| `--radius-full` | 9999px | Filter pills activos/inactivos, avatares, badges pill (`rounded-4xl`) |

### Border & Stroke

- **Border width canónico:** 1px (`border`). No usar `border-2` excepto en el accent de tablas (`border-t-2 border-t-primary`).
- **Border color canónico:** `Sea Mist` (`border-border`). Para emphasis, `border-foreground/10` vía ring es preferible sobre borde más grueso.
- **Dividers:** `border-y` en filas de tabla (per `<DataTable>` convention). `border-b` en navbar y sections.
- **No dashed borders** excepto en dropzones (e.g., `ReceiptUpload`) donde `border-2 border-dashed` es semántico, no decorativo.

### Recurring Silhouettes

- **Tables:** `rounded-md border border-t-2 border-t-primary border-border bg-card` — el accent strip de 2px en teal es la firma.
- **Cards:** `rounded-xl bg-card ring-1 ring-foreground/10` (default) o `rounded-lg` (settings, donde la jerarquía quiere ser más íntima).
- **Pills:** `rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider` — fondo `bg-muted` para container, `bg-primary text-primary-foreground` para activo.
- **Avatares:** `rounded-full` con `border border-border`. Contenido interior circular sin borde.
- **Status indicators (dots):** `size-2 rounded-full` con `bg-{tone}` semántico.

### Named Rules

**The Two-Pixel Accent Rule.** Toda tabla del producto (vía `<DataTable>` o `<table>` raw en pricing) lleva un accent strip superior de 2 píxeles en `Verdigris`: `border-t-2 border-t-primary`. Es el único lugar del producto donde se permite un borde más grueso, y su función es señalizar "esto es una tabla de datos del sistema, no decoración". **No se aplica el accent en tablas dentro de cards** — el card ya jerarquiza, sumar el accent satura. Solo en tablas top-level de página.

**The Soft Edge Rule.** Ningún borde mide más de 2 píxeles. Ninguna esquina es completamente viva (`rounded-none` está prohibido). Los únicos lugares donde se usa `rounded-none` son casos extremos (e.g., inputs de búsqueda dentro de navbar que se "funden" con el fondo). Por defecto, todo borde es 1px y todo radio es ≥4px.

---

## Components

Catálogo de los componentes centrales del sistema. Los signatures (DataTable, KpiCard, ReservationPill, FilterPill) son los que definen la identidad visual de RentalPro.

### Buttons

Variantes: `default` (primary), `outline`, `secondary`, `ghost`, `destructive`, `link`. Tamaños: `default` (h-8 px-2.5), `sm` (h-7), `xs` (h-6), `lg` (h-10), `icon` variants.

- **Shape:** `rounded-lg` (8px) en todos los tamaños; `icon` variants también.
- **Primary:** Fondo `bg-primary` (Verdigris), texto `text-primary-foreground`, `text-sm font-medium`. En dark mode, fondo `#2DBE85`.
- **Hover/Focus:** `transition-colors` (default), `focus-visible:ring-3 focus-visible:ring-ring/60` (ver The One Focus Ring Rule; ninguna variante lo sobrescribe, tampoco `destructive`). Sin translate, sin scale — la jerarquía de hover es por color, no por movimiento.
- **Outline:** Fondo `transparent`, `border border-input`, hover `bg-accent`.
- **Destructive:** Fondo `bg-destructive` (Coral Warning), texto `text-destructive-foreground`. Solo para acciones destructivas (Cancelar reserva, Eliminar propiedad). Confirmaciones destructivas siempre van en `ConfirmDialog`.

### Cards

- **Default (`<Card>`):** `rounded-xl bg-card ring-1 ring-foreground/10 py-4 px-4`. Variante `sm`: `rounded-lg py-3 px-3`. Slots: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- **Cuándo usar:** Settings (secciones de configuración), forms completos, secciones de detail sin tabla, integración MercadoPago.
- **Cuándo NO usar:** Alrededor de `<DataTable>` (rompe el framing del primitive), como contenedor genérico de página, alrededor de `<KpiCard>` (el primitive ya provee su framing).

### Badges

Variantes semánticas: `default`, `secondary`, `destructive`, `success`, `warning`, `info`, `outline`, `ghost`, `link`. Para badges de estado, **siempre** una de las 4 semánticas (`success`/`warning`/`info`/`destructive`) o `secondary` para "inactivo".

- **Shape:** `h-5 w-fit rounded-md px-2 py-0.5 text-xs font-medium`.
- **Status variants:** Fondo del token semántico (`bg-success`, `bg-warning`, etc.) + texto `text-{tone}-foreground`. En estilos inline: `bg-success/10 text-success-foreground border-success/20`.
- **Regla:** Todo badge que indique estado del dominio usa token semántico. Excepción: `outline` y `ghost` para badges no-estado (tags de plan, categorías).

### Inputs

- **Shape:** `h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base`.
- **Focus:** `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/60`. El ring es 3px al 60% de opacidad, no sólido — 60% es el piso medido que mantiene el halo suave y pasa 1.4.11 en ambos temas (ver The One Focus Ring Rule).
- **Error:** `aria-invalid:border-destructive`, sin anillo propio. El borde rojo opaco es la señal; el anillo sigue siendo el de foco.
- **Disabled:** `disabled:opacity-50 disabled:cursor-not-allowed`.

### DataTable (signature)

Primitive único para tablas de datos del producto. API: `headers[]` (string u objeto con `{label, align?}`), `children` (filas `<tr>`), `emptyState?`, `caption?`, `className?`, `minWidth?` (default "640px").

- **Wrapper:** `overflow-hidden rounded-md border border-t-2 border-t-primary border-border bg-card`.
- **`<thead>`:** `border-b bg-muted/50`.
- **`<th>`:** `px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground` (The 10px Whisper en acción).
- **`<tbody>`:** `text-xs` — **no** especificar `text-xs` en celdas individuales; el primitive lo provee.
- **Empty state:** `px-6 py-10 text-center text-sm text-muted-foreground`.
- **Filas:** `<tr>` sin `onClick` (The Row Isolation Rule). Hover `hover:bg-muted/30 transition-colors`.
- **Alineación:** Headers y celdas de la misma columna deben coincidir en `align`. Para números/montos: `align: "right"`. Para badges cortos: `align: "center"`.

### KpiCard (signature)

Primitive único para KPIs del producto. API: `label`, `value`, `unit?`, `icon?`, `tone?` (`default`/`success`/`info`/`warning`/`destructive`), `indicator?` (`{text, variant}`), `progressBar?` (`{value}`), `sublabel?`.

- **Container:** `rounded-lg border border-border bg-card p-4`. Sin shadow.
- **Label:** `text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1`.
- **Value:** `text-xl font-bold tabular-nums`. Color: `text-foreground` por defecto; cambia a `text-{tone}` cuando `tone` es `success`, `warning` o `destructive`. `default` e `info` quedan en `text-foreground` (estados neutros sin énfasis de color).
- **Icon container (opcional):** `size-9 rounded-xl bg-{tone}/10 text-{tone}` en esquina superior derecha. Sin container si no se pasa icon.
- **Indicator (opcional):** `text-[10px] font-medium mt-1` con TrendingUp (positive) o AlertTriangle (warning/neutral).
- **ProgressBar (opcional):** `h-1 rounded-full bg-muted` con fill `bg-primary`.
- **Regla:** No shadow, no status dot (eliminado en ADR-0024). Una sola variante en producto — no coexisten con otros KPI primitives.

### ReservationPill (signature)

Pill inline para estado temporal de **reservas**. Callsites legítimos: `reservation-table.tsx`, el renderer de filas de la agenda en `dashboard/page.tsx`, y `reservation-detail-client.tsx` — todos muestran el estado temporal de una reserva. **Para pagos, cobranza, propiedades y otros contextos, usar `<Badge variant>`.** En listas agrupadas por estado no se usa pill en absoluto: el color va en el encabezado del grupo (ver The Grouped Status Rule y ADR-0033).

- **Tones:** `success` (Activa, Finalizada), `info` (Próxima ≤7 días), `info-strong` (Hoy/Mañana), `warning` (Vence hoy), `destructive` (Cancelada, Vencida), `neutral` (Inactiva).
- **Shape:** `inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-tight`.
- **Dot:** `h-1.5 w-1.5 rounded-full` con clase `bg-{tone}`.
- **Por qué existe:** `<Badge>` no soporta `sublabel` (e.g., "Activa · 3 noches" debajo del label principal). El pill sí.

### FilterPill (signature)

Segmented control compacto para filtros de estado inline en headers de sección (3-7 opciones).

- **Container:** `flex items-center gap-1 rounded-full border border-border bg-muted p-1`.
- **Pill activo:** `rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground`. **Sin shadow** — consistente con la regla Calm Water: las superficies en reposo son planas y el shadow acá sería decorativo, no funcional. **Contraste medido:** `text-primary-foreground` sobre `bg-primary` da **2.28:1 en claro** y **2.17:1 en oscuro** — el único par de tokens del sistema que falla AA (4.5:1 mínimo para texto normal) en **ambos** temas. Aplica al pill activo (`dashboard-reservas-table.tsx:91`) y a la barra activa de `OccupancyStrip`. Es deuda abierta, no resuelta acá: `bg-primary`/`text-primary-foreground` es el par de color de marca, usado también en botones primarios y otras superficies — cambiarlo es una decisión de sistema, no un fix local de este componente.
- **Pill inactivo:** `rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground` (fondo transparente).
- **Layout del row:** 3 children directos en `flex justify-between gap-3` — `[título] [filtros] [acción]`.

### Dialog (floating)

Primitive para modales. **Único lugar del producto donde se permite shadow.**

- **Overlay:** `bg-black/10 backdrop-blur-xs`.
- **DialogContent:** `rounded-xl bg-popover p-4 text-sm ring-1 ring-foreground/10 shadow-lg w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto`.
- **`w-[95vw]` + `max-w-{size}`** es la convención canónica. Tamaños usados: `max-w-sm`, `max-w-md`, `max-w-lg`, `max-w-xl`, `max-w-2xl`.
- **Excepción:** `<ConfirmDialog>` usa `w-[92vw] max-w-md` — la jerarquía visual de confirmación destructiva exige menos espacio. No migrar.

### DropdownMenu & Popover (floating)

- **DropdownMenuContent:** `rounded-lg bg-popover shadow-md ring-1 ring-foreground/10`.
- **PopoverContent:** `rounded-lg bg-popover shadow-md ring-1 ring-foreground/10 w-72 p-2.5`.
- **Regla:** Ambos emergen con `shadow-md` — feedback de "salió del fondo".

### Tooltip (floating)

- **TooltipContent:** `rounded-md bg-foreground px-3 py-1.5 text-xs text-background` con arrow `size-2.5`.
- **Cuándo usar:** Para icon-buttons que requieren label accesible (sidebar toggle, copy button). NO para botones que ya tienen texto visible.

### Sidebar Nav (signature)

Dos variantes intencionales (owner vs admin) — ver sección Layout.

- **Owner active state:** `bg-primary/10 text-primary font-medium`. El teal al 10% preserva el lenguaje plano (sin shadow) y permite que el teal del texto sea el verdadero indicador.
- **Admin active state:** `bg-sidebar-accent text-sidebar-accent-foreground font-medium`. Pale mint con texto oscuro — más neutro, prioriza lectura sobre marca.
- **User footer:** Avatar + nombre + rol/plan + trigger ⋮ → dropdown con [Tema] + [Cerrar sesión]. El theme picker vive solo aquí, no en navbar.

---

## Do's and Don'ts

Guardrails consolidados. Las reglas validadas por el audit de uso real viven aquí; las reglas contextuales (por página, por flujo) viven en surface briefs, no en el sistema global.

### Do

- **Do** usar `<DataTable>` para toda tabla de datos del producto. El wrapper externo ya provee framing (`overflow-hidden rounded-md border border-t-2 border-t-primary border-border bg-card`) — no envolver de nuevo en `<Card>` ni en `<div className="overflow-x-auto">`.
- **Do** usar `<KpiCard>` como primitive único para KPIs. Si necesitas algo "diferente", es una señal de que el KPI no calza — replantéalo, no inventes un primitive paralelo.
- **Do** usar `<Badge variant="success|warning|info|destructive">` para todo estado del dominio. El mapeo es: CONFIRMED → success, VENCE HOY → warning, VENCIDO → destructive, próximos 7 días → info. No inventar tokens intermedios.
- **Do** usar `<ReservationPill>` solo para el estado temporal de una reserva (tabla de reservas, agenda del dashboard, detalle de reserva). Para badges de estado en otros contextos — pagos, cobranza, propiedades — usar `<Badge variant>`. En una lista agrupada por estado, ninguno de los dos: el color va en el encabezado del grupo (ADR-0033).
- **Do** usar `text-[10px] font-bold uppercase tracking-wider` para labels de sección, headers de tabla, KPI labels, y filter pills. Es la firma — su repetición es lo que hace el sistema coherente.
- **Do** usar `tabular-nums` en cualquier cifra (monto, contador, porcentaje, fecha corta). Las cifras sin esto "bailan" entre renders.
- **Do** usar `border-border` o `ring-1 ring-foreground/10` para jerarquía en producto. Las sombras son prerrogativa de Dialog, Dropdown, Tooltip, Sheet, y `property-card` hover con imagen.
- **Do** usar la utility `channelColors` de `@/lib/calendar/channel-colors` para marcadores de canal externo en el calendario. Los channels son semantic tokens, no colores hardcodeados.
- **Do** usar `bg-primary/10` + `text-primary` para active state del sidebar owner; `bg-sidebar-accent` + `text-sidebar-accent-foreground` para el admin. Son dos patrones intencionales, no son drift.
- **Do** usar `text-muted-foreground` para texto apagado (rol, plan, metadata) y `bg-muted` para superficies apagadas (filter pill container, table headers). Mezclarlos hace el texto invisible.
- **Do** usar `w-[95vw]` + `max-w-{size}` en todo `DialogContent`. El único `w-[92vw]` legítimo es el de `<ConfirmDialog>` (excepción documentada).
- **Do** usar `style={{ backgroundColor: property.color || "var(--primary)" }}` como fallback del color de propiedad. `property.color` es data del usuario; el fallback es identidad.

### Don't

- **Don't** envolver `<DataTable>` en `<Card>`. El primitive ya tiene su framing con el accent strip superior. Doble framing satura visualmente y rompe el patrón.
- **Don't** usar `shadow-*` en `<Card>`, tablas, filas, inputs, botones sobre superficie plana, avatares, header, navbar o sidebar. La regla "Calm Water" es estricta — cualquier shadow en estos lugares es drift.
- **Don't** crear un nuevo primitive de KPI. Si `KpiCard` no cubre el caso, significa que el caso necesita replantearse, no que necesita una variante.
- **Don't** usar hex hardcodeado (`bg-emerald-500`, `text-red-600`, `bg-amber-100`, `bg-blue-500`, `bg-green-50`, etc.) en ningún componente UI. **Excepciones documentadas y únicas:**
  - `src/lib/validations/property.ts` y `src/lib/actions/properties.ts` — default de validación Zod del color picker (capa datos).
  - `src/components/properties/property-form.tsx` — paleta de opciones del color picker (input de usuario).
  - `src/lib/payments/receipt-pdf.tsx` — documento PDF renderizado con `@react-pdf/renderer`, no UI del navegador. Son colores internos del PDF, no del producto.
  - Tests (`__tests__/*`) — mock data.
- **Don't** usar `bg-amber-50 border-amber-200`, `bg-green-50 border-green-200` ni similares para alert-boxes informativas. Usar `bg-warning/10 border-warning/20 text-warning-foreground` (o el tone que corresponda). Hoy hay 3 instancias en `billing-client.tsx` y `cancel-subscription-dialog.tsx` que requieren migración — registradas como drift conocido.
- **Don't** usar `shadow-sm` en filter pills activos. El shadow es decorativo y rompe la regla Calm Water; el pill activo ya se distingue por `bg-primary`. El contraste **no** es la razón — `text-primary-foreground` sobre `bg-primary` falla AA en ambos temas (ver medición en la sección FilterPill), deuda abierta sin fix de token todavía.
- **Don't** usar `text-destructive` como color de texto o de ícono. Es el token de RELLENO: sobre card mide 3.76:1 en claro, bajo AA. Va `text-destructive-text` (ver The Fill-vs-Text Rule). `bg-destructive` y `text-destructive-foreground` (blanco sobre rojo) siguen siendo correctos y no se tocan.
- **Don't** apagar el foco con `focus-visible:outline-none` sin dejar otro indicador visible. Un cambio de fondo no alcanza: `focus-visible:bg-muted/40` mide ~1.04:1 contra el card, muy por debajo del 3:1 que pide WCAG 1.4.11 para indicadores no textuales, y si es la misma clase que `hover:` un usuario de teclado no puede distinguir foco de hover. En una fila full-bleed dentro de un card con `overflow-hidden` el `ring-3` de la convención se recorta en los bordes laterales; ahí va `focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--foreground)]!`, que dibuja hacia adentro (caso canónico: `DashboardCobranzaList`). El color va en `--foreground`, que desde #242 es tambien lo que resuelve `--ring` (ver The One Focus Ring Rule), asi que `outline-ring` sirve igual. El `!` que lleva hoy ese callsite es **redundante**: medido en #242, `focus-visible:outline-2 focus-visible:outline-[color:var(--foreground)]` con y sin `!` resuelve al mismo color, porque `@layer theme, base, components, utilities` deja las utilidades por encima del `* { outline-ring/60 }` de `@layer base`. Lo que si hace falta es `outline-2`: sin ancho ni estilo propios, la regla base solo aporta `outline-color` y no se dibuja nada.
- **Don't** usar `onClick` que navegue en `<tr>` de tabla. Solo el botón/link de la columna de acciones navega. Esto previene selección accidental de texto, doble-trigger, y problemas de accesibilidad.
- **Don't** duplicar token values entre el frontmatter YAML y la prosa. Si un color está en `colors.verdigris`, la prosa puede nombrarlo pero no redefinir el valor oklch. El frontmatter es normativo.
- **Don't** usar `rounded-none` salvo en casos extremos justificados (e.g., inputs que se funden con el contenedor). Por defecto, todo radio es ≥4px.
- **Don't** generalizar las reglas de marketing al producto. `shadow-lg`, `shadow-2xl`, `shadow-primary/20` en landing/pricing son estética deliberada; en producto son drift.