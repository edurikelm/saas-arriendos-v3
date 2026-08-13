import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReservationDetailClient } from '../_components/reservation-detail-client';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, className, 'aria-label': ariaLabel }: { href: string; children: React.ReactNode; className?: string; 'aria-label'?: string }) => (
    <a href={href} className={className} aria-label={ariaLabel}>{children}</a>
  ),
}));

// Mock next/navigation (PaymentsSection uses useRouter for post-mutation refresh)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock cancelReservation + updateReservation
vi.mock('@/lib/actions/reservations', () => ({
  cancelReservation: vi.fn(),
  updateReservation: vi.fn(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock prisma to avoid DATABASE_URL error
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    reservation: { findFirst: vi.fn() },
    payment: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

// Mock payments actions
vi.mock('@/lib/actions/payments', () => ({
  markPaymentAsPaid: vi.fn(),
  attachReceipt: vi.fn(),
}));

// Mock ReservationDocumentsPanel
vi.mock('@/components/reservations/reservation-documents-panel', () => ({
  ReservationDocumentsPanel: () => <div data-testid="reservation-documents-panel">ReservationDocumentsPanel</div>,
}));

// Mock ReservationForm
vi.mock('@/components/reservations/reservation-form', () => ({
  ReservationForm: ({ onSubmit, onCancel }: any) => (
    <div data-testid="reservation-form">
      <button onClick={onCancel}>Cancel Form</button>
      <button onClick={() => onSubmit({})}>Submit Form</button>
    </div>
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
  notes: 'Test notes',
  createdAt: '2025-01-01T00:00:00.000Z',
  property: {
    id: 'prop-1',
    name: 'Casa Norte',
    color: '#3B82F6',
    unitsAvailable: 3,
    dailyPrice: '50000',
    monthlyPrice: null,
    type: 'APARTMENT',
    amenities: [],
    mainImage: null,
    images: [],
  },
  client: {
    id: 'client-1',
    name: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+56912345678',
    rut: '12.345.678-9',
    notes: null,
  },
  payments: [
    { id: 'p1', amount: '100000', status: 'COMPLETED', paymentType: 'RESERVATION', method: 'MERCADO_PAGO' },
    { id: 'p2', amount: '100000', status: 'PENDING', paymentType: 'RESERVATION', method: 'MERCADO_PAGO' },
  ],
  changes: [
    { id: 'c1', field: 'status', oldValue: 'PENDING', newValue: 'CONFIRMED', createdAt: '2025-01-02T00:00:00.000Z' },
  ],
  ...overrides,
});

describe('ReservationDetailClient — header v3 (person + metadata row)', () => {
  it('renders client name in the page title', () => {
    const reservation = createMockReservation();
    render(<ReservationDetailClient reservation={reservation} />);

    // The h1 must contain the client name
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toContain('Juan Pérez');
  });

  it('renders client email below the name', () => {
    const reservation = createMockReservation();
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.getByText('juan@example.com')).toBeTruthy();
  });

  it('renders client phone when present', () => {
    const reservation = createMockReservation();
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.getByText('+56912345678')).toBeTruthy();
  });

  it('omits phone separator and value when no phone', () => {
    const reservation = createMockReservation({
      client: { id: 'c1', name: 'Sin Tel', email: 'sintel@example.com', phone: null },
    });
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.queryByText('+56912345678')).toBeNull();
    expect(screen.getByText('sintel@example.com')).toBeTruthy();
  });

  it('renders temporal status pill label in eyebrow (no reservation code shown)', () => {
    const reservation = createMockReservation({ status: 'CONFIRMED' });
    render(<ReservationDetailClient reservation={reservation} />);

    // After Tier-1 eyebrow compacting: the eyebrow shows the pill label (temporal.status)
    // but no "Reserva XXXXXX" code — the code lives in the URL dropdown.
    // temporal.label for CONFIRMED + 2025 dates is "CONFIRMED"-derived; we verify the pill is present.
    // The pill label text includes the status word.
    const pillLabels = screen.getAllByText(/confirm/i);
    expect(pillLabels.length).toBeGreaterThan(0);
  });

  it('renders metadata row with property name and dates inline', () => {
    const reservation = createMockReservation();
    render(<ReservationDetailClient reservation={reservation} />);

    // Property + dates + nights in the same line (flex-wrap)
    // Note: property name also appears in the right-column "Resumen" card,
    // so we check `>= 1` rather than exact match.
    expect(screen.getAllByText('Casa Norte').length).toBeGreaterThanOrEqual(1);
    // Nights "5 noches" — end - start = 4 days + 1 = 5 nights.
    // Aparece en el resumen del timeline y en el chip de metadata (intencional).
    expect(screen.getAllByText(/5 noches/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows months instead of nights for MONTHLY reservation', () => {
    const reservation = createMockReservation({
      billingType: 'MONTHLY',
      startDate: '2025-01-01',
      endDate: '2025-03-31',
    });
    render(<ReservationDetailClient reservation={reservation} />);

    // 3 months — aparece en el resumen del timeline y en el chip de metadata.
    expect(screen.getAllByText(/3 meses/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Editar + Cancelar buttons in header for editable reservations', () => {
    const reservation = createMockReservation({ status: 'CONFIRMED' });
    render(<ReservationDetailClient reservation={reservation} />);

    // Both desktop and mobile variants render the buttons; jsdom renders both DOM trees.
    expect(screen.getAllByText('Editar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cancelar').length).toBeGreaterThan(0);
  });

  it('hides Editar + Cancelar for CANCELLED reservation', () => {
    const reservation = createMockReservation({ status: 'CANCELLED' });
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.queryByText('Editar')).toBeNull();
    expect(screen.queryByText('Cancelar')).toBeNull();
  });

  it('hides Editar + Cancelar for COMPLETED reservation', () => {
    const reservation = createMockReservation({ status: 'COMPLETED' });
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.queryByText('Editar')).toBeNull();
    expect(screen.queryByText('Cancelar')).toBeNull();
  });
});

describe('ReservationDetailClient — sections', () => {
  it('renders Detalle de pagos section', () => {
    const reservation = createMockReservation();
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.getByText('Detalle de pagos')).toBeTruthy();
  });

  it('hides Documentos section for DAILY reservation', () => {
    const reservation = createMockReservation();
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.queryByText('Documentos')).toBeNull();
  });

  it('renders Documentos section for MONTHLY reservation', () => {
    const reservation = createMockReservation({
      billingType: 'MONTHLY',
      startDate: '2025-01-01',
      endDate: '2025-03-31',
    });
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.getByText('Documentos')).toBeTruthy();
    expect(screen.getByTestId('reservation-documents-panel')).toBeTruthy();
  });

  it('renders Historial de cambios section', () => {
    const reservation = createMockReservation();
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.getByText('Historial de cambios')).toBeTruthy();
  });

  it('renders change history entries', () => {
    const reservation = createMockReservation({
      changes: [
        { id: 'c1', field: 'status', oldValue: 'PENDING', newValue: 'CONFIRMED', createdAt: '2025-01-02T00:00:00.000Z' },
        { id: 'c2', field: 'propertyId', oldValue: 'prop-old', newValue: 'prop-new', createdAt: '2025-01-03T00:00:00.000Z' },
      ],
    });
    render(<ReservationDetailClient reservation={reservation} />);

    // The history is always visible now (right column), no expand needed.
    // Use the unique old/new values to verify each change entry is rendered.
    expect(screen.getByText('CONFIRMED')).toBeTruthy();
    expect(screen.getByText('prop-new')).toBeTruthy();
    expect(screen.getByText('prop-old')).toBeTruthy();
  });

  it('shows empty history message when no changes', () => {
    const reservation = createMockReservation({ changes: [] });
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.getByText('Sin cambios registrados.')).toBeTruthy();
  });

  it('renders notes when present', () => {
    const reservation = createMockReservation({ notes: 'Cliente VIP, late check-in' });
    render(<ReservationDetailClient reservation={reservation} />);

    expect(screen.getByText('Cliente VIP, late check-in')).toBeTruthy();
  });

  it('hides notes section when notes are null', () => {
    const reservation = createMockReservation({ notes: null });
    render(<ReservationDetailClient reservation={reservation} />);

    // Notes section uses the eyebrow "Notas"
    expect(screen.queryByText('Notas')).toBeNull();
  });
});

describe('ReservationDetailClient — navigation', () => {
  it('shows back link to /reservations', () => {
    const reservation = createMockReservation();
    render(<ReservationDetailClient reservation={reservation} />);

    const backLink = screen.getByRole('link', { name: /Volver a reservas/ });
    expect(backLink.getAttribute('href')).toBe('/reservations');
  });
});
