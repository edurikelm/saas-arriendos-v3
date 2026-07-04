import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CollectionAlertsSection } from "../collection-alerts-section";
import type { CollectionAlertItem } from "@/lib/alerts/collection-alerts";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/actions/payments", () => ({
  markPaymentAsPaid: vi.fn(),
  generatePaymentLink: vi.fn(),
}));

const baseItem: CollectionAlertItem = {
  paymentId: "pay-1",
  reservationId: "res-1",
  propertyName: "Cabaña",
  clientName: "Cliente",
  dueDate: "2025-01-10",
  expiresAt: null,
  initPoint: null,
  method: "mercadopago",
  daysFromToday: 0,
};

describe("CollectionAlertsSection - radius system", () => {
  it("header Cobranza chip uses rectangular radius (rounded-md), not pill radius", () => {
    const { container } = render(
      <CollectionAlertsSection
        vencidos={[]}
        vencenHoy={[]}
        proximos7Dias={[]}
        saldos={[]}
      />
    );

    const headerChip = Array.from(container.querySelectorAll("div")).find(
      (el) => el.textContent?.trim() === "Cobranza"
    );
    expect(headerChip).toBeTruthy();
    expect(headerChip!.className).not.toMatch(/\brounded-full\b/);
    expect(headerChip!.className).toMatch(/\brounded-md\b/);
  });

  it("tab count chips use rectangular radius (rounded-md), not pill radius", () => {
    const { container } = render(
      <CollectionAlertsSection
        vencidos={[baseItem]}
        vencenHoy={[baseItem, baseItem]}
        proximos7Dias={[]}
        saldos={[]}
      />
    );

    // The numeric count chips (e.g. "1", "2") use rounded-md
    const numericChips = Array.from(container.querySelectorAll("span")).filter(
      (el) =>
        el.classList.contains("inline-flex") &&
        el.classList.contains("min-w-6") &&
        el.classList.contains("justify-center")
    );
    expect(numericChips.length).toBeGreaterThan(0);
    numericChips.forEach((chip) => {
      expect(chip.className).not.toMatch(/\brounded-full\b/);
      expect(chip.className).toMatch(/\brounded-md\b/);
    });
  });
});
