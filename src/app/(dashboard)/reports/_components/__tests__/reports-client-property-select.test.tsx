import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportDecisionSummary, DecisionByBillingTypeEntry } from "@/lib/reports/decision-summary";
import type { AgingSummary } from "@/lib/reports/collection";
import type { OutstandingSnapshot } from "@/lib/actions/reports";

/**
 * `@/components/ui/select` va SIN mockear en este archivo — a propósito.
 * `reports-client.test.tsx` mockea `Select` con un `<select>` nativo (que
 * expone `value`/`onValueChange`, pilotable con `selectOptions`), y ese mock
 * es justo lo que dejó pasar el bug real: `SelectValue` de `@base-ui/react/select`
 * renderiza el VALOR crudo cuando no recibe una función hija, así que el
 * disparador mostraba "all" al montar y el cuid de la propiedad al elegirla,
 * nunca el nombre. Un `<select>` nativo no tiene ese problema porque el
 * navegador siempre muestra el texto de la `<option>`, así que el mock no
 * podía detectarlo. Este archivo monta el `Select` real (Base UI: portal +
 * popup async, trigger `role="combobox"`, ítems `role="option"` — confirmado
 * en `src/components/ui/select.tsx` y `payment-actions.test.tsx`).
 */
vi.mock("@/components/ui/date-range-picker", () => ({
  DateRangePicker: () => null,
}));

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

import { ReportsClient, type ReportsClientProps } from "../reports-client";
import {
  getDecisionSummary,
  getOutstandingSnapshot,
  getReservationsReportCount,
  getReservationsReportForExport,
} from "@/lib/actions/reports";

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
  { id: "cly8f8a9r0000abc123def456", name: "Casa Central", unitsAvailable: 2 },
  { id: "cly8f8a9r0001abc123def789", name: "Depto Playa", unitsAvailable: 1 },
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
  vi.mocked(getReservationsReportForExport).mockResolvedValue([]);
});

describe("ReportsClient - selector de propiedad (Select real, sin mock)", () => {
  it("al montar, el disparador dice 'Todas las propiedades', nunca 'all'", async () => {
    renderClient();
    await waitFor(() => expect(getDecisionSummary).toHaveBeenCalled());

    const trigger = screen.getByRole("combobox", { name: /propiedad/i });
    expect(trigger.textContent).toContain("Todas las propiedades");
    expect(trigger.textContent).not.toContain("all");
  });

  it("al elegir una propiedad, el disparador muestra su nombre, nunca su id", async () => {
    renderClient();
    await waitFor(() => expect(getDecisionSummary).toHaveBeenCalled());
    vi.mocked(getDecisionSummary).mockClear();

    const user = userEvent.setup();
    const trigger = screen.getByRole("combobox", { name: /propiedad/i });
    await user.click(trigger);

    const option = await screen.findByRole("option", { name: "Casa Central" });
    await user.click(option);

    await waitFor(() => {
      expect(trigger.textContent).toContain("Casa Central");
    });
    expect(trigger.textContent).not.toContain(PROPERTIES[0].id);

    await waitFor(() => {
      expect(getDecisionSummary).toHaveBeenCalledWith(
        expect.objectContaining({ propertyId: PROPERTIES[0].id }),
      );
    });
  });
});
