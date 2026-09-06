import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddPaymentDialog } from '../add-payment-dialog';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const defaultProps = {
  reservationId: 'res-1',
  totalPrice: '100000',
  paidAmount: 30000,
  open: true,
  onOpenChange: vi.fn(),
  onSuccess: vi.fn(),
};

async function selectCash(user: ReturnType<typeof userEvent.setup>) {
  const selectTrigger = screen.getByRole('combobox');
  await user.click(selectTrigger);
  const cashOption = screen.getByText('Efectivo');
  await user.click(cashOption);
}

describe('AddPaymentDialog - paymentType selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  });

  it('defaults to RESERVATION mode with maxAmount badge visible', () => {
    render(<AddPaymentDialog {...defaultProps} />);

    expect(screen.getByText('Pago de Reserva')).toBeTruthy();
    expect(screen.getByText(/Máximo/)).toBeTruthy();
    expect(screen.queryByText('Título')).toBeNull();
    expect(screen.queryByText('Descripción (opcional)')).toBeNull();
  });

  it('maxAmount chip uses rectangular radius (rounded-md), not pill radius', () => {
    render(<AddPaymentDialog {...defaultProps} />);

    const maxAmountText = screen.getByText(/Máximo/);
    const maxChip = maxAmountText.closest('button');
    expect(maxChip).toBeTruthy();
    expect(maxChip!.className).not.toMatch(/\brounded-full\b/);
    expect(maxChip!.className).toMatch(/\brounded-md\b/);
  });

  it('switches to EXTRA mode and shows title/description, hides max badge', async () => {
    const user = userEvent.setup();
    render(<AddPaymentDialog {...defaultProps} />);

    await user.click(screen.getByText('Pago Extra'));

    expect(screen.queryByText(/Máximo/)).toBeNull();
    expect(screen.getByText('Título')).toBeTruthy();
    expect(screen.getByText('Descripción (opcional)')).toBeTruthy();
  });

  it('switching back to RESERVATION restores max badge and hides extra fields', async () => {
    const user = userEvent.setup();
    render(<AddPaymentDialog {...defaultProps} />);

    await user.click(screen.getByText('Pago Extra'));
    await user.click(screen.getByText('Pago de Reserva'));

    expect(screen.getByText(/Máximo/)).toBeTruthy();
    expect(screen.queryByText('Título')).toBeNull();
    expect(screen.queryByText('Descripción (opcional)')).toBeNull();
  });

  it('keeps total/pending summary visible in both modes', async () => {
    const user = userEvent.setup();
    render(<AddPaymentDialog {...defaultProps} />);

    expect(screen.getByText('Total reserva:')).toBeTruthy();
    expect(screen.getByText('Ya pagado:')).toBeTruthy();
    expect(screen.getByText('Pendiente:')).toBeTruthy();

    await user.click(screen.getByText('Pago Extra'));

    expect(screen.getByText('Total reserva:')).toBeTruthy();
    expect(screen.getByText('Ya pagado:')).toBeTruthy();
    expect(screen.getByText('Pendiente:')).toBeTruthy();
  });

  it('allows EXTRA payment with amount exceeding pending limit', async () => {
    const user = userEvent.setup();
    render(<AddPaymentDialog {...defaultProps} />);

    await user.click(screen.getByText('Pago Extra'));

    const titleInput = screen.getByPlaceholderText('Ej: Limpieza extra, Daños menores');
    await user.type(titleInput, 'Limpieza extra');

    const amountInput = screen.getByPlaceholderText('0');
    await user.type(amountInput, '200000');

    await user.click(screen.getByText('Generar Link'));

    expect(mockFetch).toHaveBeenCalled();
  });

  it('shows validation error when EXTRA payment has no title', async () => {
    const user = userEvent.setup();
    render(<AddPaymentDialog {...defaultProps} />);

    await user.click(screen.getByText('Pago Extra'));

    const amountInput = screen.getByPlaceholderText('0');
    await user.type(amountInput, '50000');

    await user.click(screen.getByText('Generar Link'));

    const toastModule = await import('sonner');
    expect(toastModule.toast.error).toHaveBeenCalledWith('El título es requerido para pagos extra');
  });

  it('sends paymentType=EXTRA with title and description for CASH method', async () => {
    const user = userEvent.setup();
    render(<AddPaymentDialog {...defaultProps} />);

    await user.click(screen.getByText('Pago Extra'));
    await selectCash(user);

    const titleInput = screen.getByPlaceholderText('Ej: Limpieza extra, Daños menores');
    await user.type(titleInput, 'Limpieza extra');

    const descriptionInput = screen.getByPlaceholderText('Descripción opcional');
    await user.type(descriptionInput, 'Limpieza de alfombras');

    const amountInput = screen.getByPlaceholderText('0');
    await user.type(amountInput, '50000');

    await user.click(screen.getByText('Registrar Pago'));

    expect(mockFetch).toHaveBeenCalled();
    const url = mockFetch.mock.calls[0][0];
    const formData = mockFetch.mock.calls[0][1].body;
    expect(url).toBe('/api/payments');
    expect(formData.get('paymentType')).toBe('EXTRA');
    expect(formData.get('title')).toBe('Limpieza extra');
    expect(formData.get('description')).toBe('Limpieza de alfombras');
  });

  it('sends paymentType=RESERVATION for default mode with CASH', async () => {
    const user = userEvent.setup();
    render(<AddPaymentDialog {...defaultProps} />);

    await selectCash(user);

    const amountInput = screen.getByPlaceholderText('0');
    await user.type(amountInput, '50000');

    await user.click(screen.getByText('Registrar Pago'));

    expect(mockFetch).toHaveBeenCalled();
    const formData = mockFetch.mock.calls[0][1].body;
    expect(formData.get('paymentType')).toBe('RESERVATION');
  });

  it('con pagos de arriendo ya cobrados, reporta el pendiente real y rechaza un monto mayor', async () => {
    // Regresión: reservation-detail-client.tsx le pasaba paidAmount=0 al hook de pagos
    // con el comentario (falso) "no se usa aquí". Este diálogo recibía siempre 0, así
    // que topaba contra el TOTAL del contrato en vez del pendiente real de arriendo,
    // dejando pasar cobros muy superiores a lo adeudado.
    //
    // Reserva de $455.000 con $195.000 de arriendo ya cobrados → pendiente real $260.000.
    const user = userEvent.setup();
    render(
      <AddPaymentDialog {...defaultProps} totalPrice="455000" paidAmount={195000} />
    );

    // El resumen debe reflejar lo ya cobrado, no partir siempre de "$0".
    expect(screen.getByText('$195.000')).toBeTruthy();

    await selectCash(user);

    const amountInput = screen.getByPlaceholderText('0');
    // Mayor al pendiente real ($260.000) pero menor al total del contrato ($455.000):
    // con el bug viejo esto se aceptaba, porque el tope efectivo era el total.
    await user.type(amountInput, '300000');

    await user.click(screen.getByText('Registrar Pago'));

    const toastModule = await import('sonner');
    expect(toastModule.toast.error).toHaveBeenCalledWith(
      'El monto no puede exceder el pendiente de arriendo: $260.000'
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows all 3 payment methods available in EXTRA mode', async () => {
    const user = userEvent.setup();
    render(<AddPaymentDialog {...defaultProps} />);

    await user.click(screen.getByText('Pago Extra'));

    const selectTrigger = screen.getByRole('combobox');
    await user.click(selectTrigger);

    expect(screen.getAllByText('Mercado Pago').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Efectivo')).toBeTruthy();
    expect(screen.getByText('Transferencia')).toBeTruthy();
  });
});
