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

describe("ReservationForm — comisión en el resumen financiero", () => {
  const stay = {
    propertyId: "prop-1",
    clientId: "client-1",
    billingType: "DAILY" as const,
    unitsBooked: 1,
    startDate: new Date("2026-09-05T15:00:00Z"),
    endDate: new Date("2026-09-12T15:00:00Z"),
  };

  it("descuenta la comisión del total y muestra el neto para el propietario", async () => {
    // 8 noches × $50.000 = $400.000 ; 8,5% = $34.000 ; neto $366.000
    renderForm({ ...stay, brokerId: "brk-1", commissionRate: 8.5 });

    await waitFor(() => expect(screen.getByText("$400.000")).toBeTruthy());
    expect(screen.getByText("−$34.000")).toBeTruthy();
    expect(screen.getByText("Neto para ti")).toBeTruthy();
    expect(screen.getByText("$366.000")).toBeTruthy();
  });

  it("nombra al captador junto al descuento", async () => {
    renderForm({ ...stay, brokerId: "brk-1", commissionRate: 8.5 });

    // Con coma, como el resto de la interfaz.
    await waitFor(() =>
      expect(screen.getByText(/Ana Rojas \(\s*8,5%\)/)).toBeTruthy(),
    );
  });

  it("sin captador el resumen no habla de comisión ni de neto", async () => {
    renderForm(stay);

    await waitFor(() => expect(screen.getByText("$400.000")).toBeTruthy());
    expect(screen.queryByText("Neto para ti")).toBeNull();
  });

  it("el resumen va al final, después de captación y notas", async () => {
    // Es la conclusión: queda pegada al botón que la confirma.
    renderForm({ ...stay, brokerId: "brk-1", commissionRate: 8.5 });

    await waitFor(() => expect(screen.getByText("Resumen Financiero")).toBeTruthy());

    const order = ["Captación", "Notas adicionales", "Resumen Financiero"].map((label) => {
      const node = screen.getByText(label);
      return Array.from(document.querySelectorAll("form *")).indexOf(node);
    });

    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });
});
