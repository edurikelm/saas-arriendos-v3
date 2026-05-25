import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { ReservationForm } from '../reservation-form';
import { createClient } from '@/lib/actions/clients';

const mockProperties = [
  { id: 'prop-1', name: 'Departamento Centro', unitsAvailable: 3, dailyPrice: '50000', monthlyPrice: '800000' },
  { id: 'prop-2', name: 'Cabaña Montaña', unitsAvailable: 1, dailyPrice: '35000', monthlyPrice: null },
];

const mockClients = [
  { id: 'client-1', name: 'Juan Pérez', email: 'juan@example.com' },
  { id: 'client-2', name: 'María García', email: 'maria@example.com' },
  { id: 'client-3', name: 'Pedro López', email: 'pedro@example.com' },
];

const fiveClients = [
  { id: 'c1', name: 'Cliente 1', email: 'c1@test.com' },
  { id: 'c2', name: 'Cliente 2', email: 'c2@test.com' },
  { id: 'c3', name: 'Cliente 3', email: 'c3@test.com' },
  { id: 'c4', name: 'Cliente 4', email: 'c4@test.com' },
  { id: 'c5', name: 'Cliente 5', email: 'c5@test.com' },
];

const mockSubmit = vi.fn();

describe('ReservationForm - Creación rápida de cliente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra "Crear nuevo cliente..." en el footer del combobox', async () => {
    const user = userEvent.setup();

    render(
      <ReservationForm
        properties={mockProperties}
        clients={mockClients}
        onSubmit={mockSubmit}
        plan="PRO"
      />
    );

    const trigger = screen.getByText('Seleccionar cliente');
    await user.click(trigger);

    expect(screen.getByText('Crear nuevo cliente...')).toBeTruthy();
  });

  it('click en footer action abre el modal con ClientForm', async () => {
    const user = userEvent.setup();

    render(
      <ReservationForm
        properties={mockProperties}
        clients={mockClients}
        onSubmit={mockSubmit}
        plan="PRO"
      />
    );

    const trigger = screen.getByText('Seleccionar cliente');
    await user.click(trigger);

    await user.click(screen.getByText('Crear nuevo cliente...'));

    expect(screen.getByText('Nuevo Cliente')).toBeTruthy();
    expect(screen.getByText('Guardar Cliente')).toBeTruthy();
  });

  it('plan FREE con 5+ clientes muestra texto deshabilitado', async () => {
    const user = userEvent.setup();

    render(
      <ReservationForm
        properties={mockProperties}
        clients={fiveClients}
        onSubmit={mockSubmit}
        plan="FREE"
      />
    );

    const trigger = screen.getByText('Seleccionar cliente');
    await user.click(trigger);

    expect(screen.getByText('Límite de 5 clientes alcanzado (plan FREE)')).toBeTruthy();
    expect(screen.queryByText('Crear nuevo cliente...')).toBeNull();
  });

  it('crear cliente exitoso lo agrega a la lista y auto-selecciona', async () => {
    const user = userEvent.setup();

    vi.mocked(createClient).mockResolvedValue({
      success: true,
      client: { id: 'new-1', name: 'Nuevo Cliente', email: 'nuevo@test.com' },
    } as any);

    render(
      <ReservationForm
        properties={mockProperties}
        clients={mockClients}
        onSubmit={mockSubmit}
        plan="PRO"
      />
    );

    const trigger = screen.getByText('Seleccionar cliente');
    await user.click(trigger);

    await user.click(screen.getByText('Crear nuevo cliente...'));

    await user.type(screen.getByPlaceholderText('Juan Pérez'), 'Nuevo Cliente');
    await user.type(screen.getByPlaceholderText('juan@ejemplo.com'), 'nuevo@test.com');
    await user.click(screen.getByText('Guardar Cliente'));

    await waitFor(() => {
      expect(screen.queryByText('Nuevo Cliente')).toBeTruthy();
    });

    expect(vi.mocked(createClient)).toHaveBeenCalled();
    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith('Cliente creado correctamente');
  });

  it('crear cliente con error muestra error inline', async () => {
    const user = userEvent.setup();

    vi.mocked(createClient).mockResolvedValue({
      error: 'Ya existe un cliente con ese email',
    });

    render(
      <ReservationForm
        properties={mockProperties}
        clients={mockClients}
        onSubmit={mockSubmit}
        plan="PRO"
      />
    );

    const trigger = screen.getByText('Seleccionar cliente');
    await user.click(trigger);

    await user.click(screen.getByText('Crear nuevo cliente...'));

    await user.type(screen.getByPlaceholderText('Juan Pérez'), 'Nuevo Cliente');
    await user.type(screen.getByPlaceholderText('juan@ejemplo.com'), 'nuevo@test.com');
    await user.click(screen.getByText('Guardar Cliente'));

    await waitFor(() => {
      expect(screen.getByText('Ya existe un cliente con ese email')).toBeTruthy();
    });

    expect(screen.getByText('Nuevo Cliente')).toBeTruthy();
  });
});
