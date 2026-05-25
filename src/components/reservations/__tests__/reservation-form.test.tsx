import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/actions/reservations', () => ({
  getBlockedDates: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/actions/clients', () => ({
  createClient: vi.fn(),
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
  { id: 'prop-2', name: 'Cabaña Montaña', unitsAvailable: 1, dailyPrice: '35000', monthlyPrice: null },
];

const mockClients = [
  { id: 'client-1', name: 'Juan Pérez', email: 'juan@example.com' },
  { id: 'client-2', name: 'María García', email: 'maria@example.com' },
  { id: 'client-3', name: 'Pedro López', email: 'pedro@example.com' },
];

const mockSubmit = vi.fn();

describe('ReservationForm - Clientes Combobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza combobox de clientes con lista de opciones', () => {
    render(
      <ReservationForm
        properties={mockProperties}
        clients={mockClients}
        onSubmit={mockSubmit}
        plan="PRO"
      />
    );

    expect(screen.getByText('Seleccionar cliente')).toBeTruthy();
  });

  it('selecciona un cliente', async () => {
    const user = userEvent.setup();

    render(
      <ReservationForm
        properties={mockProperties}
        clients={mockClients}
        onSubmit={mockSubmit}
        plan="PRO"
      />
    );

    const placeholderTrigger = screen.getByText('Seleccionar cliente');
    await user.click(placeholderTrigger);

    const option = screen.getByText('Juan Pérez');
    await user.click(option);

    expect(screen.getByText(/juan pérez/i)).toBeTruthy();
  });

  it('crea clientsList como estado local y renderiza todos los clientes en el dropdown', async () => {
    const user = userEvent.setup();

    render(
      <ReservationForm
        properties={mockProperties}
        clients={mockClients}
        onSubmit={mockSubmit}
        plan="PRO"
      />
    );

    const placeholderTrigger = screen.getByText('Seleccionar cliente');
    await user.click(placeholderTrigger);

    expect(screen.getByText('Juan Pérez')).toBeTruthy();
    expect(screen.getByText('María García')).toBeTruthy();
    expect(screen.getByText('Pedro López')).toBeTruthy();
  });
});
