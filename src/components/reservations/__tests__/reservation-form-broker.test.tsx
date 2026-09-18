import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/actions/reservations', () => ({
  getBlockedDates: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/actions/clients', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/actions/brokers', () => ({
  getActiveBrokers: vi.fn().mockResolvedValue([
    { id: 'brk-1', name: 'Ana Rojas', defaultCommissionRate: 10 },
    { id: 'brk-2', name: 'Beto Sanhueza', defaultCommissionRate: 8.5 },
  ]),
}));

vi.mock('@/components/ui/date-range-picker', () => ({
  DateRangePicker: () => <div data-testid="date-range-picker">DateRangePicker</div>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ReservationForm } from '../reservation-form';

const mockProperties = [
  { id: 'prop-1', name: 'Departamento Centro', unitsAvailable: 3, dailyPrice: '50000', monthlyPrice: '800000' },
];

const mockClients = [{ id: 'client-1', name: 'Juan Pérez', email: 'juan@example.com' }];

function renderForm(initialData?: Parameters<typeof ReservationForm>[0]['initialData']) {
  return render(
    <ReservationForm
      properties={mockProperties}
      clients={mockClients}
      initialData={initialData}
      onSubmit={vi.fn()}
      plan="PRO"
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReservationForm — Captación', () => {
  it('arranca sin captador y sin campo de comisión', async () => {
    renderForm();

    await waitFor(() => expect(screen.getByText('Captación')).toBeTruthy());
    // El porcentaje solo aparece cuando hay a quién pagárselo.
    expect(screen.queryByLabelText('Comisión (%) *')).toBeNull();
  });

  it('lista los captadores activos con su porcentaje por defecto', async () => {
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => expect(screen.getByText('Captación')).toBeTruthy());
    await user.click(screen.getByText('Sin captador', { selector: 'span' }));

    await waitFor(() => expect(screen.getByText('Ana Rojas')).toBeTruthy());
    expect(screen.getByText('Beto Sanhueza')).toBeTruthy();
    expect(screen.getByText('10% por defecto')).toBeTruthy();
    expect(screen.getByText('8,5% por defecto')).toBeTruthy();
  });

  it('elegir un captador precarga su porcentaje y muestra el campo', async () => {
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => expect(screen.getByText('Captación')).toBeTruthy());
    await user.click(screen.getByText('Sin captador', { selector: 'span' }));
    await user.click(screen.getByText('Beto Sanhueza'));

    await waitFor(() => {
      const rate = screen.getByLabelText('Comisión (%) *') as HTMLInputElement;
      expect(rate.value).toBe('8.5');
    });
  });

  it('avisa que el porcentaje queda fijo en esta reserva', async () => {
    renderForm({ brokerId: 'brk-1', commissionRate: 10 });

    await waitFor(() =>
      expect(screen.getByText(/Queda fijo en esta reserva/)).toBeTruthy(),
    );
  });

  it('al editar, precarga el captador y la tasa congelada de la reserva', async () => {
    renderForm({ brokerId: 'brk-2', commissionRate: 6.25 });

    await waitFor(() => expect(screen.getByText('Beto Sanhueza')).toBeTruthy());
    const rate = screen.getByLabelText('Comisión (%) *') as HTMLInputElement;
    // 6,25 y no el 8,5 por defecto del captador: la reserva manda (ADR-0040 §2).
    expect(rate.value).toBe('6.25');
  });
});

describe("ReservationForm — barra de resumen", () => {
  const stay = {
    propertyId: "prop-1",
    clientId: "client-1",
    billingType: "DAILY" as const,
    unitsBooked: 1,
    startDate: new Date("2026-09-05T15:00:00Z"),
    endDate: new Date("2026-09-12T15:00:00Z"),
  };

  /** Texto de la barra, normalizado. */
  function summaryText() {
    return (screen.getByTestId("reservation-summary").textContent ?? "").replace(/\s+/g, " ");
  }

  it("va primero en el formulario y queda fija arriba al scrollear", async () => {
    // Es la lectura en vivo del formulario: tiene que verse mientras se llena,
    // y en móvil el formulario scrollea.
    renderForm(stay);

    const bar = await screen.findByTestId("reservation-summary");
    const form = bar.closest("form")!;

    expect(form.firstElementChild).toBe(bar);
    expect(bar.className).toContain("sticky");
    // Negativo, igual al padding del form: el sticky se pega al borde del
    // padding, así que `top-0` dejaba 16px por donde asomaban las filas.
    expect(bar.className).toContain("-top-4");
    expect(bar.className).toContain("sm:-top-6");
  });

  it("sin fechas explica qué falta en vez de quedar vacía", async () => {
    // Misma altura antes y después: el formulario no salta cuando aparece el total.
    renderForm({ propertyId: "prop-1", clientId: "client-1" });

    await waitFor(() =>
      expect(summaryText()).toContain("Elige propiedad y fechas para calcular el total"),
    );
  });

  it("sin captador muestra la estadía y el total", async () => {
    // 8 noches × $50.000 = $400.000
    renderForm(stay);

    await waitFor(() => expect(summaryText()).toContain("Total $400.000"));
    expect(summaryText()).toContain("8 noches");
    expect(summaryText()).not.toContain("Neto");
  });

  it("con captador descuenta la comisión y termina en el neto", async () => {
    // $400.000 al 8,5% = $34.000 ; neto $366.000
    renderForm({ ...stay, brokerId: "brk-1", commissionRate: 8.5 });

    await waitFor(() => expect(summaryText()).toContain("Neto $366.000"));
    expect(summaryText()).toContain("$400.000");
    expect(summaryText()).toContain("−$34.000");
  });

  it("nombra al captador con la tasa en formato chileno", async () => {
    renderForm({ ...stay, brokerId: "brk-1", commissionRate: 8.5 });

    // Rótulo antes de la cifra, como el resto de la cuenta: "Ana Rojas 8,5% −$34.000".
    await waitFor(() => expect(summaryText()).toContain("Ana Rojas 8,5% −$34.000"));
  });

  it("en móvil la comisión cede pero sigue disponible para lectores de pantalla", async () => {
    // Visualmente oculta bajo `sm`, nunca con `hidden`: `sr-only` la deja en el
    // árbol de accesibilidad en todos los anchos.
    renderForm({ ...stay, brokerId: "brk-1", commissionRate: 8.5 });

    await waitFor(() => expect(summaryText()).toContain("−$34.000"));
    const segment = screen.getByText("−$34.000").parentElement!;
    expect(segment.className).toContain("sr-only");
    expect(segment.className).toContain("sm:not-sr-only");
    expect(segment.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("usa la superficie de resumen del sistema, no el fondo del diálogo", async () => {
    // Opaca a propósito: es sticky y el contenido pasa por debajo.
    renderForm(stay);

    const bar = await screen.findByTestId("reservation-summary");
    expect(bar.className).toContain("bg-summary");
    expect(bar.className).toContain("border-summary-border");
    expect(bar.className).not.toContain("bg-popover");
  });

  it("todo en una sola línea: la barra no apila filas", async () => {
    renderForm({ ...stay, brokerId: "brk-1", commissionRate: 8.5 });

    const bar = await screen.findByTestId("reservation-summary");
    expect(bar.className).toContain("flex");
    expect(bar.className).not.toContain("flex-col");
    expect(bar.className).not.toContain("grid");
  });
});
