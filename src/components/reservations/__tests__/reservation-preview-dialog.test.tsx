import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReservationPreviewDialog } from '../reservation-preview-dialog';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const createMockReservation = (overrides: Record<string, any> = {}) => ({
  id: 'res-1',
  propertyId: 'prop-1',
  clientId: 'client-1',
  startDate: '2025-01-01',
  endDate: '2025-01-05',
  billingType: 'DAILY',
  unitsBooked: 1,
  totalPrice: '200000',
  status: 'CONFIRMED',
  bookingAirbnb: false,
  notes: null,
  createdAt: '2025-01-01T00:00:00Z',
  property: {
    id: 'prop-1',
    name: 'Casa Norte',
    color: '#3B82F6',
    unitsAvailable: 3,
    dailyPrice: '50000',
    monthlyPrice: null,
  },
  client: {
    id: 'client-1',
    name: 'Juan Pérez',
    email: 'juan@example.com',
  },
  payments: [],
  ...overrides,
});

describe('ReservationPreviewDialog', () => {
  it('shows client name', () => {
    const reservation = createMockReservation();
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Juan Pérez')).toBeTruthy();
  });

  it('shows status badge CONFIRMED', () => {
    const reservation = createMockReservation({ status: 'CONFIRMED' });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Confirmada')).toBeTruthy();
  });

  it('shows status badge CANCELLED', () => {
    const reservation = createMockReservation({ status: 'CANCELLED' });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Cancelada')).toBeTruthy();
  });

  it('shows status badge PENDING', () => {
    const reservation = createMockReservation({ status: 'PENDING' });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Pendiente')).toBeTruthy();
  });

  it('shows property name', () => {
    const reservation = createMockReservation();
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Casa Norte')).toBeTruthy();
  });

  it('shows stay dates with nights', () => {
    const reservation = createMockReservation();
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    // Jan 1 to Jan 5 = 5 nights
    expect(screen.getByText(/\d+ noches/)).toBeTruthy();
  });

  it('shows total price', () => {
    const reservation = createMockReservation({ totalPrice: '200000' });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getAllByText(/\$200\.000/)[0]).toBeTruthy();
  });

  it('shows CTA link to /reservations/{id}', () => {
    const reservation = createMockReservation({ id: 'res-123' });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    const link = screen.getByRole('link', { name: /Ver reserva completa/ });
    expect(link.getAttribute('href')).toBe('/reservations/res-123');
  });

  it('shows pending amount panel when pendingAmount > 0', () => {
    const reservation = createMockReservation({
      totalPrice: '200000',
      payments: [
        { id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' },
      ],
    });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    // $200,000 - $50,000 = $150,000 pending
    expect(screen.getByText(/Pendiente/)).toBeTruthy();
    expect(screen.getByText(/\$150\.000/)).toBeTruthy();
  });

  it('does not show notes section when notes is null', () => {
    const reservation = createMockReservation({ notes: null });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText('Notas')).toBeNull();
  });

  it('does not show notes section when notes is empty string', () => {
    const reservation = createMockReservation({ notes: '' });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText('Notas')).toBeNull();
  });

  it('shows notes section when notes has content', () => {
    const reservation = createMockReservation({ notes: 'Cliente preferred floor' });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Notas')).toBeTruthy();
    expect(screen.getByText('Cliente preferred floor')).toBeTruthy();
  });

  it('shows Airbnb badge when bookingAirbnb is true', () => {
    const reservation = createMockReservation({ bookingAirbnb: true });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getAllByText('Airbnb')[0]).toBeTruthy();
  });

  it('does not show Airbnb badge when bookingAirbnb is false', () => {
    const reservation = createMockReservation({ bookingAirbnb: false });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText('Airbnb')).toBeNull();
  });

  it('shows billing type chip for DAILY', () => {
    const reservation = createMockReservation({ billingType: 'DAILY' });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Diario')).toBeTruthy();
  });

  it('shows billing type chip for MONTHLY', () => {
    const reservation = createMockReservation({
      billingType: 'MONTHLY',
      startDate: '2025-01-01',
      endDate: '2025-03-31',
    });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Mensual')).toBeTruthy();
  });

  it('shows units chip when unitsBooked > 1', () => {
    const reservation = createMockReservation({ unitsBooked: 3 });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('3 unidades')).toBeTruthy();
  });

  it('does not show units chip when unitsBooked is 1', () => {
    const reservation = createMockReservation({ unitsBooked: 1 });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText(/unidades/)).toBeNull();
  });

  it('shows client email as clickable mailto', () => {
    const reservation = createMockReservation();
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    const emailLink = screen.getByRole('link', { name: /juan@example\.com/ });
    expect(emailLink.getAttribute('href')).toBe('mailto:juan@example.com');
  });

  it('shows client phone as clickable tel when present', () => {
    const reservation = createMockReservation({
      client: { id: 'client-1', name: 'Juan Pérez', email: 'juan@example.com', phone: '+56912345678' },
    });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    const phoneLink = screen.getByRole('link', { name: /\+56912345678/ });
    expect(phoneLink.getAttribute('href')).toBe('tel:+56912345678');
  });

  it('does not show phone when client has no phone', () => {
    const reservation = createMockReservation({
      client: { id: 'client-1', name: 'Juan Pérez', email: 'juan@example.com' },
    });
    render(
      <ReservationPreviewDialog
        reservation={reservation}
        open={true}
        onClose={() => {}}
      />
    );

    expect(screen.queryByRole('link', { name: /tel:/ })).toBeNull();
  });
});
