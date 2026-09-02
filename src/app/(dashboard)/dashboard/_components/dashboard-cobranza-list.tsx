import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/domain/timezone";

/**
 * Bucket de cobranza — alineado 1:1 con `DashboardCollectionBucket`
 * (`@/lib/dashboard/summary`). Redefinido localmente para no acoplar este
 * componente puramente presentacional al seam de dominio.
 *
 * Los tres buckets sobreviven en el dato porque describen tres estados
 * distintos del dominio; la UI los colapsa en DOS grupos visuales (ver
 * `GROUP_OF_BUCKET`). La distinción entre "vence hoy" y "vence en N días"
 * la carga el texto de vencimiento de cada fila, que es más preciso que un
 * encabezado, y no un tercer grupo.
 */
export type CobranzaBucket = "OVERDUE" | "DUE_TODAY" | "UPCOMING_7D";

export interface CobranzaItem {
  reservationId: string;
  clientName: string;
  propertyName: string;
  /**
   * Tipo de arriendo de la reserva. Se muestra como label junto a la
   * propiedad, nunca como color: `info` (el token que DESIGN.md asigna a
   * DAILY/MONTHLY) reintroduciría un tercer eje cromático en una sección
   * cuyo problema era exactamente ese. DESIGN.md, sección Colors:
   * "Diferencia DAILY vs MONTHLY por label, no por color".
   */
  billingType: "DAILY" | "MONTHLY";
  amount: number;
  dueDate: Date | null;
  /** Días desde hoy hasta el vencimiento (negativo = vencido). `null` cuando no hay `dueDate`. */
  daysFromToday: number | null;
  bucket: CobranzaBucket;
  /**
   * Cantidad de cuotas vencidas detrás de esta fila (una fila = una
   * reserva, puede agrupar varias cuotas MONTHLY). `dueDate`/`daysFromToday`
   * ya describen la cuota vencida más temprana; este campo permite decir
   * "2 cuotas vencidas" en vez de "1 cobro vencido" cuando hay más de una.
   */
  overdueCount: number;
  /**
   * Cantidad de cuotas que vencen hoy o dentro de los próximos 7 días,
   * detrás de la cuota vencida más temprana ya representada por `dueDate`.
   */
  dueSoonCount: number;
  /**
   * Días hasta la cuota más temprana de `dueSoonCount`. `null` cuando
   * `dueSoonCount === 0` o cuando esa cuota no tiene `dueDate` atribuible
   * (degrada el sufijo a "+N por vencer" sin plazo).
   */
  dueSoonDaysFromToday: number | null;
}

/** Grupo visual del card. Dos, no tres: ver `CobranzaBucket`. */
type CobranzaGroupKey = "OVERDUE" | "DUE_SOON";

const GROUP_OF_BUCKET: Record<CobranzaBucket, CobranzaGroupKey> = {
  OVERDUE: "OVERDUE",
  DUE_TODAY: "DUE_SOON",
  UPCOMING_7D: "DUE_SOON",
};

const GROUP_LABEL: Record<CobranzaGroupKey, string> = {
  OVERDUE: "Vencidos",
  DUE_SOON: "Por vencer",
};

/**
 * El ÚNICO portador de color de la sección.
 *
 * La lista llega ordenada por urgencia y ahora está agrupada por ella, así
 * que el estado de una fila se deduce del grupo que la contiene: repetirlo
 * en la fila (pill + monto teñido + texto teñido, como hacía la versión
 * anterior) codificaba el mismo hecho tres veces en el mismo color y dejaba
 * ~7 zonas cromáticas en un card de 400px. Ahora el color aparece una vez
 * por grupo — dos veces en todo el card — y el monto recupera
 * `text-foreground`, que es lo que permite compararlo entre filas.
 *
 * `warning` usa su `*-foreground` (el token legible sobre card, oscuro en
 * light / claro en dark) y NO `--warning`, que es el token de relleno: a
 * 0.78 de lightness sobre card blanco no alcanza contraste AA.
 */
const GROUP_TEXT: Record<CobranzaGroupKey, string> = {
  OVERDUE: "text-destructive-text",
  DUE_SOON: "text-warning-foreground",
};

/** Orden de render de los grupos. `items` ya llega en este orden. */
const GROUP_ORDER: CobranzaGroupKey[] = ["OVERDUE", "DUE_SOON"];

/**
 * Label de estado por bucket. Sin representación visual propia desde que el
 * grupo carga el estado; sobrevive en un `<span className="sr-only">` dentro
 * de cada fila, para que un lector de pantalla reciba el estado exacto
 * (incluida la distinción "vence hoy" vs "pendiente", que el encabezado de
 * grupo fusiona) sin depender de haber leído el encabezado y sin perder el
 * resto del contenido de la fila. Ver el comentario en el `<Link>`.
 */
const BUCKET_LABEL: Record<CobranzaBucket, string> = {
  OVERDUE: "Vencido",
  DUE_TODAY: "Vence hoy",
  UPCOMING_7D: "Pendiente",
};

const BILLING_LABEL: Record<CobranzaItem["billingType"], string> = {
  DAILY: "Diaria",
  MONTHLY: "Mensual",
};

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Plazo relativo de una cuota que vence dentro de la ventana de 7 días
 * (`0 <= days <= 7` por construcción de `dueSoon` en
 * `@/lib/reports/collection`): 0 → "hoy", 1 → "mañana", N → "en N días".
 *
 * Existe para que el segundo tramo de `dueLabel` comparta la misma escalera
 * que la rama sin vencidos, que ya resolvía esos dos casos. Sin ella el
 * sufijo salía como "vence en 0 días" / "vence en 1 días" — y no es un borde
 * raro: `generateMonthlyPayments` fija todos los `dueDate` al día 1, así que
 * ocurría cada día 1 y cada último día de mes.
 */
function plazoRelativo(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `en ${days} días`;
}

interface DueLabelParts {
  /** Texto principal: siempre en la línea. */
  primary: string;
  /**
   * Sufijo "+N por vencer" cuando existe. Se mantiene como nodo separado de
   * `primary` (no concatenado) para poder darle `whitespace-nowrap`: el
   * tramo envuelve como unidad en vez de partirse a mitad de "+1 vence en 4
   * días". `null` cuando no aplica.
   */
  chip: string | null;
}

/**
 * Línea de vencimiento: relativo primero (accionable), absoluto después (verificable).
 * "Vence en 3 días · 1 sept" escanea mejor que "Vence: 1 sept", que obliga al dueño
 * a calcular la urgencia mentalmente.
 *
 * Una fila = una reserva, que puede agrupar varias cuotas MONTHLY impagas.
 * `daysFromToday`/`dueDate` siempre describen la cuota impaga MÁS temprana
 * (la vencida, si hay una); `overdueCount`/`dueSoonCount` revelan cuántas
 * cuotas más hay detrás, para no mentir con "1 cobro" cuando en realidad
 * son 2 vencidas + 1 por vencer.
 *
 * No-overdue (`overdueCount === 0`): bucket DUE_TODAY / UPCOMING_7D / sin
 * fecha — siempre `chip: null`.
 *
 * Overdue (`overdueCount >= 1`):
 *  - 1 cuota vencida  → "Venció hace N días".
 *  - ≥2 cuotas vencidas → "N cuotas vencidas".
 *  - Si hay cuotas por vencer dentro de 7 días, el chip lleva "+N
 *    vence/vencen en X días" (degrada a "+N por vencer" sin plazo si no hay
 *    `dueSoonDaysFromToday`); si no, `primary` incorpora la fecha absoluta
 *    de la cuota vencida más temprana ("desde <fecha>" cuando son ≥2
 *    cuotas, para dejar claro que es el inicio del rango, no una fecha
 *    puntual) y `chip` queda `null`.
 */
function dueLabelParts(item: {
  daysFromToday: number | null;
  dueDate: Date | null;
  overdueCount: number;
  dueSoonCount: number;
  dueSoonDaysFromToday: number | null;
}): DueLabelParts {
  const { daysFromToday, dueDate, overdueCount, dueSoonCount, dueSoonDaysFromToday } = item;

  if (daysFromToday === null) return { primary: "Sin fecha de vencimiento", chip: null };

  if (overdueCount === 0) {
    const relative =
      daysFromToday < -1
        ? `Venció hace ${Math.abs(daysFromToday)} días`
        : daysFromToday === -1
          ? "Venció ayer"
          : daysFromToday === 0
            ? "Vence hoy"
            : daysFromToday === 1
              ? "Vence mañana"
              : `Vence en ${daysFromToday} días`;

    return { primary: dueDate ? `${relative} · ${formatDateOnly(dueDate)}` : relative, chip: null };
  }

  const primary =
    overdueCount >= 2
      ? `${overdueCount} cuotas vencidas`
      : daysFromToday === -1
        ? "Venció ayer"
        : `Venció hace ${Math.abs(daysFromToday)} días`;

  if (dueSoonCount > 0) {
    const verb = dueSoonCount > 1 ? "vencen" : "vence";
    const chip =
      dueSoonDaysFromToday !== null
        ? `+${dueSoonCount} ${verb} ${plazoRelativo(dueSoonDaysFromToday)}`
        : `+${dueSoonCount} por vencer`;
    return { primary, chip };
  }

  if (dueDate) {
    const suffix = overdueCount >= 2 ? `desde ${formatDateOnly(dueDate)}` : formatDateOnly(dueDate);
    return { primary: `${primary} · ${suffix}`, chip: null };
  }

  return { primary, chip: null };
}

/** Subtotal real de un grupo (ventana completa, no solo los items visibles). */
export interface CobranzaGroupTotal {
  amount: number;
  count: number;
  /**
   * Porción del subtotal que no tiene fila visible en el card (filas
   * truncadas por `collectionLimit`). Alimenta la línea "+N cobros más" al
   * pie del grupo: sin ella el encabezado puede decir 8 cobros sobre cuatro
   * filas y la aritmética del card no cierra a la vista. Opcional — la
   * derivación desde items visibles no tiene truncamiento que reportar.
   */
  hiddenAmount?: number;
  hiddenCount?: number;
}

interface DashboardCobranzaListProps {
  items: CobranzaItem[];
  /**
   * Si se provee, el título se renderiza como bloque standalone AFUERA del card,
   * junto con un link "Ver todas" que apunta a esta URL (alineado con el patrón
   * canónico de `/dashboard` sección "Próximas reservas"). Si se omite, el título
   * se mantiene dentro del card (back-compat).
   */
  viewAllHref?: string;
  /** Label del link "Ver todas". Default: "Ver todas". */
  viewAllLabel?: string;
  /**
   * Total y cantidad de TODOS los cobros pendientes, no solo los visibles.
   * `items` viene truncado (top N por `collectionLimit`), así que derivarlo
   * de `items` mentiría cuando hay más cobros de los que caben. Si se omite,
   * se deriva de `items`.
   */
  totalAmount?: number;
  totalCount?: number;
  /**
   * Subtotales por grupo, con el mismo criterio que `totalAmount`/`totalCount`:
   * cubren la ventana completa, no los items visibles. Vienen de
   * `collection.windowGroups` (`@/lib/dashboard/summary`), que por
   * construcción suman `windowAmount` / `windowCount`.
   *
   * El reparto es por COBRO, no por fila: una fila con 2 cuotas vencidas + 1
   * por vencer aporta 2 al subtotal de "Vencidos" y 1 al de "Por vencer",
   * aunque se renderice entera bajo "Vencidos". Por eso un subtotal de grupo
   * puede ser menor que la suma de las filas que lo acompañan — la línea de
   * vencimiento de cada fila ("+1 vence en 4 días") es la que reconcilia.
   *
   * Si se omiten, se derivan de los items visibles (aproximación de
   * back-compat: cuenta filas, no cobros).
   */
  groupTotals?: Partial<Record<CobranzaGroupKey, CobranzaGroupTotal>>;
}

/**
 * Cobranza sidebar for /dashboard. Muestra hasta N cobros agrupados por
 * urgencia (vencidos → por vencer), cada uno con cliente, propiedad, tipo de
 * arriendo, monto y vencimiento relativo. Cada fila es un link a la reserva —
 * la sección es una lista de pendientes, no un reporte de solo lectura.
 *
 * El agrupamiento es lo que permite que la sección sea plana en color: el
 * encabezado dice el estado UNA vez para todas sus filas, así que ninguna
 * fila necesita pill ni monto teñido.
 *
 * Standalone primitive — no server data fetching; data is computed by
 * `getDashboardSummary` (`@/lib/dashboard/summary`) and passed as props.
 */
export function DashboardCobranzaList({
  items,
  viewAllHref,
  viewAllLabel = "Ver todas",
  totalAmount,
  totalCount,
  groupTotals,
}: DashboardCobranzaListProps) {
  const resolvedCount = totalCount ?? items.length;
  const resolvedTotal = totalAmount ?? items.reduce((sum, item) => sum + item.amount, 0);

  // Un grupo se renderiza si tiene filas visibles O si su subtotal de
  // ventana es > 0. Antes se exigía lo primero, así que con 4+ reservas
  // vencidas el grupo "Por vencer" desaparecía entero y su plata aparecía
  // solo en el footer: el dueño veía un total mayor que la suma de los
  // grupos, sin ninguna señal de por qué. Un grupo sin filas visibles se
  // renderiza como encabezado + la línea "+N cobros más".
  const groups = GROUP_ORDER.map((key) => {
    const groupItems = items.filter((item) => GROUP_OF_BUCKET[item.bucket] === key);
    const fallback: CobranzaGroupTotal = {
      amount: groupItems.reduce((sum, item) => sum + item.amount, 0),
      count: groupItems.length,
    };
    return { key, items: groupItems, total: groupTotals?.[key] ?? fallback };
  }).filter((group) => group.items.length > 0 || group.total.count > 0);

  return (
    <section aria-labelledby="cobros-pendientes-heading" className="flex h-full flex-col">
      {viewAllHref && (
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="cobros-pendientes-heading"
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Cobros pendientes
          </h2>
          <Link
            href={viewAllHref}
            className="text-[10px] font-bold uppercase text-primary hover:underline"
          >
            {viewAllLabel}
          </Link>
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-border bg-card">
        {viewAllHref ? null : (
          <div className="border-b border-border px-4 py-3">
            <h2
              id="cobros-pendientes-heading"
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Cobros pendientes
            </h2>
          </div>
        )}
        {groups.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            <p className="text-xs font-bold text-foreground">Sin cobros pendientes</p>
            <p className="text-[10px] text-muted-foreground">
              No hay vencimientos en los próximos 7 días.
            </p>
          </div>
        ) : (
          <div className="flex-1">
            {groups.map((group, groupIdx) => {
              const headingId = `cobros-grupo-${group.key.toLowerCase()}`;
              // Cobros del grupo que ninguna fila representa (filas cortadas
              // por el límite del card). Los cobros de una fila VISIBLE no
              // entran acá aunque pertenezcan al otro grupo: ya se leen en su
              // monto y en su línea de vencimiento.
              const hiddenCount = group.total.hiddenCount ?? 0;
              const hiddenAmount = group.total.hiddenAmount ?? 0;
              return (
                <div key={group.key}>
                  {/*
                    Encabezado de grupo: label + cantidad a la izquierda,
                    subtotal a la derecha, ambos en el color del grupo. Una
                    sola banda cromática por grupo — el reemplazo de las ~7
                    zonas de color que dejaba una pill por fila.

                    La cantidad está en COBROS (cuotas + extras), igual que el
                    footer, no en filas: una fila MONTHLY puede agrupar varias
                    cuotas, así que "Vencidos · 3" sobre 2 filas es correcto y
                    consistente con "Total · 6 cobros". Y una fila reparte sus
                    cobros entre los dos grupos según venzan o no — por eso el
                    subtotal puede ser menor que la suma de las filas de abajo
                    (issue #238); la línea de vencimiento de cada fila es la
                    que reconcilia la diferencia.
                  */}
                  <div
                    className={cn(
                      "flex items-baseline justify-between gap-2 border-b border-border px-4 pb-2",
                      groupIdx === 0 ? "pt-3" : "pt-5"
                    )}
                  >
                    <h3
                      id={headingId}
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest tabular-nums",
                        GROUP_TEXT[group.key]
                      )}
                    >
                      {GROUP_LABEL[group.key]} · {group.total.count}
                    </h3>
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-bold tabular-nums",
                        GROUP_TEXT[group.key]
                      )}
                    >
                      {formatCLP(group.total.amount)}
                    </span>
                  </div>
                  <ul aria-labelledby={headingId} className="py-1">
                    {group.items.map((item, idx) => {
                      const { primary, chip } = dueLabelParts(item);
                      return (
                        <li key={`${item.reservationId}-${idx}`}>
                          <Link
                            href={`/reservations/${item.reservationId}`}
                            className="block px-4 py-2 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--foreground)]!"
                          >
                            {/*
                              El estado del grupo viaja acá para que el nombre
                              accesible del link no dependa de haber leído el
                              encabezado. Va como `sr-only` DENTRO de la fila y
                              NO como `aria-label` en el contenedor: un
                              `aria-label` REEMPLAZA el contenido como nombre
                              accesible en vez de complementarlo, así que la
                              versión anterior anunciaba solo "cliente — monto —
                              estado" y se llevaba por delante la propiedad, el
                              tipo de arriendo y la línea de vencimiento — el
                              60% de la fila, incluido el dato accionable
                              (cuántas cuotas y cuándo vence la próxima).
                              Issue #237.

                              El foco: `outline` (no `ring`) con offset
                              negativo, porque el card tiene `overflow-hidden`
                              y un ring exterior en una fila full-bleed se
                              recorta en los bordes. El color va con `!` porque
                              `globals.css` tiene un `* { outline-color:
                              var(--ring)/50 }` en `@layer base` que le gana a
                              la utilidad; sin el `!` el anillo vuelve al teal
                              de marca, que sobre card mide 2.28:1 en claro
                              (WCAG 1.4.11 pide 3:1). Con `--foreground`:
                              16.95:1 claro / 15.7:1 oscuro, medido.
                            */}
                            <span className="sr-only">{BUCKET_LABEL[item.bucket]}</span>
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">
                                {item.clientName}
                              </p>
                              {/*
                                Monto en `text-foreground`, no en el color del
                                bucket: es el dato que el dueño compara ENTRE
                                filas, y un monto que cambia de color por fila
                                no se puede escanear como columna. La urgencia
                                ya la carga el grupo.
                              */}
                              <p className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                                {formatCLP(item.amount)}
                              </p>
                            </div>
                            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                              {item.propertyName} · {BILLING_LABEL[item.billingType]}
                            </p>
                            <p className="text-[10px] tabular-nums text-muted-foreground">
                              <span>{primary}</span>
                              {chip && (
                                <>
                                  {" · "}
                                  <span className="whitespace-nowrap">{chip}</span>
                                </>
                              )}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <li>
                        {viewAllHref ? (
                          <Link
                            href={viewAllHref}
                            className="block px-4 py-2 text-[10px] font-bold tabular-nums text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--foreground)]!"
                          >
                            +{hiddenCount} {hiddenCount === 1 ? "cobro" : "cobros"} más ·{" "}
                            {formatCLP(hiddenAmount)}
                          </Link>
                        ) : (
                          <p className="px-4 py-2 text-[10px] font-bold tabular-nums text-muted-foreground">
                            +{hiddenCount} {hiddenCount === 1 ? "cobro" : "cobros"} más ·{" "}
                            {formatCLP(hiddenAmount)}
                          </p>
                        )}
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        {/*
          El total siempre va al fondo de la card, incluso sin cobros
          (0 · $0) — el dueño no debería tener que inferir el estado de su
          cartera por la ausencia de este bloque.
        */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Total · {resolvedCount} {resolvedCount === 1 ? "cobro" : "cobros"}
          </span>
          <span className="text-xs font-bold tabular-nums text-foreground">
            {formatCLP(resolvedTotal)}
          </span>
        </div>
      </div>
    </section>
  );
}
