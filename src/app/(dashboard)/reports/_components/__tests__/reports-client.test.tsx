import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatCLP } from "@/lib/format/currency";
import type { ReportDecisionSummary, DecisionByBillingTypeEntry } from "@/lib/reports/decision-summary";
import type { AgingSummary } from "@/lib/reports/collection";
import type { OutstandingSnapshot, ReservationReport } from "@/lib/actions/reports";

// ────────────────────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/actions/reports", () => ({
  getDecisionSummary: vi.fn(),
  getOutstandingSnapshot: vi.fn(),
  getReservationsReportCount: vi.fn(),
  getReservationsReportForExport: vi.fn(),
}));

vi.mock("@/lib/export-utils", () => ({
  exportToExcel: vi.fn(),
  exportToPDF: vi.fn(),
}));

/**
 * `DateRangePicker` real es un Popover (`@base-ui/react/popover`) con un
 * `react-day-picker` adentro. Abrirlo y clickear dos celdas de día en jsdom es
 * alcanzable (el propio test de `date-range-picker.test.tsx` abre el popover),
 * pero *seleccionar un rango* de dos días de calendario reales añade una capa
 * de fragilidad (qué mes está visible, qué `data-day` exacto clickear) que no
 * aporta nada a lo que este archivo quiere probar: que `onDateChange`, cuando
 * se dispara, active "Personalizado" y dispare `getDecisionSummary` con ese
 * rango. Igual que `reservation-form.test.tsx`, `reservations-list-client.test.tsx`
 * y `date-range-picker.test.tsx` (indirectamente, mockeando el consumidor en
 * los dos primeros) — mockeamos el primitivo y probamos el contrato de
 * `onDateChange` directamente, con un botón que expone la fecha fija elegida.
 */
const CUSTOM_FROM = new Date(2026, 0, 5);
const CUSTOM_TO = new Date(2026, 0, 20);

vi.mock("@/components/ui/date-range-picker", () => ({
  DateRangePicker: ({ onDateChange }: { onDateChange: (d: { from: Date; to: Date }) => void }) => (
    <button type="button" data-testid="custom-range-trigger" onClick={() => onDateChange({ from: CUSTOM_FROM, to: CUSTOM_TO })}>
      Elegir rango personalizado
    </button>
  ),
}));

/**
 * `Select` real es `@base-ui/react/select` (portal + popup con roving focus).
 * Ningún test existente en el repo lo dirige sin mockear (ver
 * `reservations-list-client.test.tsx`, que lo mockea igual). Lo reemplazamos
 * por un `<select>` nativo: mismo contrato (`value`/`onValueChange`), pilotable
 * con `userEvent.selectOptions`.
 */
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select aria-label="Propiedad" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

import { ReportsClient, type ReportsClientProps } from "../reports-client";
import {
  getDecisionSummary,
  getOutstandingSnapshot,
  getReservationsReportCount,
  getReservationsReportForExport,
} from "@/lib/actions/reports";

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

function emptyBillingEntry(): DecisionByBillingTypeEntry {
  return {
    collectedCash: 0,
    collectedCashFromCancelledReservations: 0,
    outstandingBalance: 0,
    accruedRevenue: 0,
    occupiedNightUnits: 0,
    capacityNightUnits: 0,
    occupancyRate: 0,
    reservationCount: 0,
  };
}

function buildSummary(overrides: Partial<ReportDecisionSummary> = {}): ReportDecisionSummary {
  return {
    collectedCash: 0,
    collectedCashFromCancelledReservations: 0,
    outstandingBalance: 0,
    accruedRevenue: 0,
    occupiedNightUnits: 0,
    capacityNightUnits: 0,
    occupancyRate: 0,
    reservationCount: 0,
    byBillingType: { DAILY: emptyBillingEntry(), MONTHLY: emptyBillingEntry() },
    byProperty: [],
    activity: "NONE",
    cash: { byMonth: [], byMethod: {} },
    ...overrides,
  };
}

function buildAging(overrides: Partial<AgingSummary> = {}): AgingSummary {
  return {
    buckets: [
      { key: "DUE_SOON", label: "Vence en 7 días", amount: 0, count: 0 },
      { key: "OVERDUE_1_30", label: "Vencido 1–30 días", amount: 0, count: 0 },
      { key: "OVERDUE_31_60", label: "Vencido 31–60 días", amount: 0, count: 0 },
      { key: "OVERDUE_60_PLUS", label: "Vencido más de 60", amount: 0, count: 0 },
    ],
    totalDue: 0,
    totalOverdue: 0,
    ...overrides,
  };
}

function buildSnapshot(overrides: Partial<OutstandingSnapshot> = {}): OutstandingSnapshot {
  return {
    aging: buildAging(),
    topDebtors: [],
    totals: { totalToCollect: 0, totalOverdue: 0, pendingInvoices: 0 },
    ...overrides,
  };
}

const PROPERTIES = [
  { id: "prop-1", name: "Casa Central", unitsAvailable: 2 },
  { id: "prop-2", name: "Depto Playa", unitsAvailable: 1 },
];

function renderClient(overrides: Partial<ReportsClientProps> = {}) {
  const props: ReportsClientProps = {
    initialSnapshot: null,
    initialProperties: PROPERTIES,
    initialSession: { plan: "PRO" },
    initialDecisionSummary: null,
    ...overrides,
  };
  return render(<ReportsClient {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDecisionSummary).mockResolvedValue(buildSummary());
  vi.mocked(getOutstandingSnapshot).mockResolvedValue(buildSnapshot());
  vi.mocked(getReservationsReportCount).mockResolvedValue(0);
  vi.mocked(getReservationsReportForExport).mockResolvedValue([] as ReservationReport[]);
});

// ────────────────────────────────────────────────────────────────────────────
// Plan FREE vs PRO
// ────────────────────────────────────────────────────────────────────────────

describe("ReportsClient - plan FREE", () => {
  it("solo 'Mes actual' queda habilitado y el picker personalizado no se renderiza", async () => {
    renderClient({ initialSession: { plan: "FREE" } });
    await waitFor(() => expect(getDecisionSummary).toHaveBeenCalled());

    expect((screen.getByRole("button", { name: /^mes actual/i }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /mes anterior/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /últimos 3 meses/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /últimos 6 meses/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /año actual/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /personalizado/i }) as HTMLButtonElement).disabled).toBe(true);

    expect(screen.queryByTestId("custom-range-trigger")).toBeNull();
    expect(screen.getByText(/plan free: solo mes actual/i)).toBeTruthy();
  });
});

describe("ReportsClient - plan PRO", () => {
  it("todos los rangos rápidos están habilitados y el picker personalizado se renderiza", async () => {
    renderClient({ initialSession: { plan: "PRO" } });
    await waitFor(() => expect(getDecisionSummary).toHaveBeenCalled());

    expect((screen.getByRole("button", { name: /mes anterior/i }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /^personalizado/i }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("custom-range-trigger")).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Rango personalizado activa "Personalizado"
// ────────────────────────────────────────────────────────────────────────────

describe("ReportsClient - rango personalizado", () => {
  it("elegir fechas en el picker activa 'Personalizado' y llama a getDecisionSummary con ese rango", async () => {
    renderClient();
    await waitFor(() => expect(getDecisionSummary).toHaveBeenCalled());
    vi.mocked(getDecisionSummary).mockClear();

    const user = userEvent.setup();
    await user.click(screen.getByTestId("custom-range-trigger"));

    // El botón "Personalizado" del rango rápido pasa a activo (aria-pressed).
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^personalizado/i, pressed: true })).toBeTruthy();
    });

    await waitFor(() => {
      expect(getDecisionSummary).toHaveBeenCalledWith(
        expect.objectContaining({ rangeStart: CUSTOM_FROM, rangeEnd: CUSTOM_TO }),
      );
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Alcance de cada fetch
// ────────────────────────────────────────────────────────────────────────────

describe("ReportsClient - alcance de cada fetch", () => {
  it("cambiar el rango rápido vuelve a llamar getDecisionSummary pero NO getOutstandingSnapshot", async () => {
    renderClient();
    await waitFor(() => expect(getDecisionSummary).toHaveBeenCalled());
    await waitFor(() => expect(getOutstandingSnapshot).toHaveBeenCalled());
    vi.mocked(getDecisionSummary).mockClear();
    vi.mocked(getOutstandingSnapshot).mockClear();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /mes anterior/i }));

    await waitFor(() => expect(getDecisionSummary).toHaveBeenCalled());
    expect(getOutstandingSnapshot).not.toHaveBeenCalled();
  });

  it("cambiar la propiedad llama a los dos fetch, con el propertyId", async () => {
    renderClient();
    await waitFor(() => expect(getDecisionSummary).toHaveBeenCalled());
    await waitFor(() => expect(getOutstandingSnapshot).toHaveBeenCalled());
    vi.mocked(getDecisionSummary).mockClear();
    vi.mocked(getOutstandingSnapshot).mockClear();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Propiedad"), "prop-1");

    await waitFor(() => {
      expect(getDecisionSummary).toHaveBeenCalledWith(expect.objectContaining({ propertyId: "prop-1" }));
    });
    await waitFor(() => {
      expect(getOutstandingSnapshot).toHaveBeenCalledWith(expect.objectContaining({ propertyId: "prop-1" }));
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Nunca se vacía la página durante un refetch
// ────────────────────────────────────────────────────────────────────────────

describe("ReportsClient - nunca se vacía durante un refetch", () => {
  it("mantiene el KPI anterior visible mientras el refetch está pendiente y lo anuncia por role=status", async () => {
    const initialSummary = buildSummary({ collectedCash: 111_111, accruedRevenue: 200_000 });
    vi.mocked(getDecisionSummary).mockResolvedValue(initialSummary);

    renderClient();

    await waitFor(() => {
      expect(screen.getByRole("group", { name: "Cobrado" }).textContent).toContain(formatCLP(111_111));
    });

    // El próximo refetch queda pendiente hasta que el test decida resolverlo.
    let resolvePending: (value: ReportDecisionSummary) => void = () => {};
    const pending = new Promise<ReportDecisionSummary>((resolve) => {
      resolvePending = resolve;
    });
    vi.mocked(getDecisionSummary).mockReturnValueOnce(pending);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /mes anterior/i }));

    // Mientras el refetch está pendiente, el contenido anterior sigue en el DOM...
    expect(screen.getByRole("group", { name: "Cobrado" }).textContent).toContain(formatCLP(111_111));

    // ...y el live-region de la Sección 1 anuncia la actualización en curso.
    const statuses = screen.getAllByRole("status");
    const periodStatus = statuses.find((el) => /actualizando resultado del período/i.test(el.textContent ?? ""));
    expect(periodStatus).toBeTruthy();

    resolvePending(buildSummary({ collectedCash: 222_222, accruedRevenue: 300_000 }));

    await waitFor(() => {
      expect(screen.getByRole("group", { name: "Cobrado" }).textContent).toContain(formatCLP(222_222));
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// El enlace a Pagos
// ────────────────────────────────────────────────────────────────────────────

describe("ReportsClient - enlace a Pagos", () => {
  // 2026-01-15T02:00 UTC es 2026-01-14 23:00 en America/Santiago (UTC-3):
  // un cálculo ingenuo en UTC ("hoy" = 15, "ayer" = 14) da un día distinto
  // al correcto en wall-time SCL ("hoy" = 14, "ayer" = 13). Este instante
  // hace que el test detecte una regresión a aritmética UTC.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-01-15T02:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const agingWithVencidos = buildAging({
    buckets: [
      { key: "DUE_SOON", label: "Vence en 7 días", amount: 500_000, count: 5 },
      { key: "OVERDUE_1_30", label: "Vencido 1–30 días", amount: 100_000, count: 2 },
      { key: "OVERDUE_31_60", label: "Vencido 31–60 días", amount: 50_000, count: 3 },
      { key: "OVERDUE_60_PLUS", label: "Vencido más de 60", amount: 20_000, count: 1 },
    ],
    totalDue: 670_000,
    totalOverdue: 170_000,
  });

  it("lleva status=PENDING, dateField=vencimiento, paymentType=RESERVATION, dateTo=ayer(SCL), y cuenta solo los tramos vencidos", async () => {
    vi.mocked(getOutstandingSnapshot).mockResolvedValue(buildSnapshot({ aging: agingWithVencidos }));

    renderClient();

    // count = OVERDUE_1_30(2) + OVERDUE_31_60(3) + OVERDUE_60_PLUS(1) = 6.
    // NO incluye el tramo "Vence en 7 días" (count: 5).
    const link = await screen.findByRole("link", { name: /ver los 6 cobros vencidos en pagos/i });
    const params = new URLSearchParams(link.getAttribute("href")!.split("?")[1]);

    expect(params.get("status")).toBe("PENDING");
    expect(params.get("dateField")).toBe("vencimiento");
    expect(params.get("paymentType")).toBe("RESERVATION");
    // "ayer" en Santiago es 2026-01-13, NO 2026-01-14 (lo que daría un slice UTC).
    expect(params.get("dateTo")).toBe("2026-01-13");
    expect(params.get("propertyId")).toBeNull();
  });

  it("agrega propertyId solo cuando hay una propiedad elegida", async () => {
    vi.mocked(getOutstandingSnapshot).mockResolvedValue(buildSnapshot({ aging: agingWithVencidos }));

    renderClient();
    await screen.findByRole("link", { name: /ver los 6 cobros vencidos en pagos/i });

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Propiedad"), "prop-1");

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /ver los 6 cobros vencidos en pagos/i });
      const params = new URLSearchParams(link.getAttribute("href")!.split("?")[1]);
      expect(params.get("propertyId")).toBe("prop-1");
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Tasa de cobranza
// ────────────────────────────────────────────────────────────────────────────

describe("ReportsClient - tasa de cobranza", () => {
  it('muestra "—" cuando accruedRevenue es 0', async () => {
    vi.mocked(getDecisionSummary).mockResolvedValue(buildSummary({ collectedCash: 0, accruedRevenue: 0 }));

    renderClient();

    await waitFor(() => {
      expect(screen.getByRole("group", { name: "Tasa de cobranza" }).textContent).toContain("—");
    });
  });

  it("muestra el porcentaje real sobre 100% cuando lo cobrado supera lo facturado del período", async () => {
    vi.mocked(getDecisionSummary).mockResolvedValue(
      buildSummary({ collectedCash: 150_000, accruedRevenue: 100_000 }),
    );

    renderClient();

    await waitFor(() => {
      expect(screen.getByRole("group", { name: "Tasa de cobranza" }).textContent).toContain("150%");
    });
  });
});
