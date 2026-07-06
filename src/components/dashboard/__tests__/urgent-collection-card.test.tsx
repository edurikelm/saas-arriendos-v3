import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { UrgentCollectionCard } from "../urgent-collection-card";
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
  markPaymentAsPaid: vi.fn(async () => ({ success: true })),
  generatePaymentLink: vi.fn(async () => ({ success: true })),
}));

Object.assign(navigator, {
  clipboard: { writeText: vi.fn(async () => undefined) },
});

const baseItem: CollectionAlertItem = {
  paymentId: "pay-1",
  reservationId: "res-1",
  propertyName: "Cabaña",
  clientName: "Victor Varas",
  dueDate: "2026-06-01T12:00:00.000Z",
  expiresAt: null,
  initPoint: null,
  method: "mercadopago",
  daysFromToday: -3,
  amount: 100000,
};

function expectInDoc(node: Element | null): asserts node is Element {
  expect(node).not.toBeNull();
}

describe("UrgentCollectionCard", () => {
  it("muestra el total a cobrar y el conteo total en el header", () => {
    render(
      <UrgentCollectionCard
        vencidos={[{ ...baseItem, paymentId: "p1", amount: 50000 }]}
        vencenHoy={[{ ...baseItem, paymentId: "p2", amount: 75000 }]}
        proximos7Dias={[{ ...baseItem, paymentId: "p3", amount: 120000 }]}
      />
    );

    expectInDoc(screen.queryByText("$245.000"));
    expectInDoc(screen.queryByText(/3 alertas en total/i));
  });

  it("el chip Cobranza del header usa rounded-md (no pill)", () => {
    const { container } = render(
      <UrgentCollectionCard
        vencidos={[]}
        vencenHoy={[]}
        proximos7Dias={[]}
      />
    );

    const headerChip = Array.from(container.querySelectorAll("div")).find(
      (el) => el.textContent?.trim() === "Cobranza"
    );
    expect(headerChip).toBeTruthy();
    expect(headerChip!.className).not.toMatch(/\brounded-full\b/);
    expect(headerChip!.className).toMatch(/\brounded-md\b/);
  });

  it("deshabilita tabs sin datos (aria-disabled)", () => {
    render(
      <UrgentCollectionCard
        vencidos={[baseItem]}
        vencenHoy={[]}
        proximos7Dias={[]}
      />
    );

    const vencenHoyTab = screen.getByRole("tab", { name: /vencen hoy/i });
    const proximosTab = screen.getByRole("tab", { name: /próx\. 7 días/i });
    // base-ui Tabs expone el estado deshabilitado via aria-disabled
    expect(vencenHoyTab.getAttribute("aria-disabled")).toBe("true");
    expect(proximosTab.getAttribute("aria-disabled")).toBe("true");

    // El tab con datos debe estar habilitado
    const vencidosTab = screen.getByRole("tab", { name: /vencidos/i });
    expect(vencidosTab.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("los badges de conteo usan la variante semántica correspondiente", () => {
    render(
      <UrgentCollectionCard
        vencidos={[baseItem]}
        vencenHoy={[]}
        proximos7Dias={[
          { ...baseItem, paymentId: "p-proximo", daysFromToday: 3 },
        ]}
      />
    );

    const tabVencidos = screen.getByRole("tab", { name: /vencidos/i });
    const tabProximos = screen.getByRole("tab", { name: /próx\. 7 días/i });
    expectInDoc(within(tabVencidos).queryByText("1"));
    expectInDoc(within(tabProximos).queryByText("1"));
    // Cada badge usa su variante (clase bg-*)
    expect(
      within(tabVencidos)
        .getByText("1")
        .className.includes("bg-destructive/10")
    ).toBe(true);
    expect(
      within(tabProximos)
        .getByText("1")
        .className.includes("bg-info/10")
    ).toBe(true);
  });

  it("abre el MarkPaidDialog al clickear 'Marcar pagado'", async () => {
    render(
      <UrgentCollectionCard
        vencidos={[baseItem]}
        vencenHoy={[]}
        proximos7Dias={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /marcar pagado/i }));

    await waitFor(() => {
      expectInDoc(screen.queryByRole("dialog"));
    });
    expectInDoc(
      screen.queryByRole("heading", { name: /marcar como pagado/i })
    );
  });

  it("abre el menu de overflow con 'Generar link MP' y 'Ver reserva'", async () => {
    render(
      <UrgentCollectionCard
        vencidos={[baseItem]}
        vencenHoy={[]}
        proximos7Dias={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /más acciones/i }));

    await waitFor(() => {
      expectInDoc(screen.queryByText(/ver reserva/i));
      expectInDoc(screen.queryByText(/generar link mp/i));
    });
  });

  it("muestra 'Copiar link vigente' solo cuando hay link activo", async () => {
    const expFuture = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const itemConLink: CollectionAlertItem = {
      ...baseItem,
      paymentId: "p-link",
      initPoint: "https://mp.example/x",
      expiresAt: expFuture,
    };
    render(
      <UrgentCollectionCard
        vencidos={[itemConLink]}
        vencenHoy={[]}
        proximos7Dias={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /más acciones/i }));

    await waitFor(() => {
      expectInDoc(screen.queryByText(/copiar link vigente/i));
    });
  });

  it("no muestra 'Copiar link vigente' sin link activo", async () => {
    render(
      <UrgentCollectionCard
        vencidos={[{ ...baseItem, expiresAt: null, initPoint: null }]}
        vencenHoy={[]}
        proximos7Dias={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /más acciones/i }));

    await waitFor(() => {
      expectInDoc(screen.queryByText(/ver reserva/i));
    });
    expect(screen.queryByText(/copiar link vigente/i)).toBeNull();
  });

  it("usa 'Vencidos' como tab por defecto si tiene datos", () => {
    render(
      <UrgentCollectionCard
        vencidos={[baseItem]}
        vencenHoy={[baseItem]}
        proximos7Dias={[baseItem]}
      />
    );

    const vencidosTab = screen.getByRole("tab", { name: /vencidos/i });
    expect(vencidosTab.getAttribute("aria-selected")).toBe("true");
  });

  it("cae al primer bucket con datos si vencidos esta vacio", () => {
    render(
      <UrgentCollectionCard
        vencidos={[]}
        vencenHoy={[{ ...baseItem, paymentId: "hoy" }]}
        proximos7Dias={[{ ...baseItem, paymentId: "prox" }]}
      />
    );

    const hoyTab = screen.getByRole("tab", { name: /vencen hoy/i });
    expect(hoyTab.getAttribute("aria-selected")).toBe("true");
  });
});
