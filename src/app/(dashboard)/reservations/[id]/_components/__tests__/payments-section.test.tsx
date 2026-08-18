import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PaymentsSection } from '../payments-section';

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    reservation: { findFirst: vi.fn() },
    payment: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/actions/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/actions/mercado-pago', () => ({
  getMercadoPagoToken: vi.fn(),
}));

vi.mock('@/lib/actions/payments', () => ({
  confirmPayment: vi.fn(),
  revertPayment: vi.fn(),
  generatePaymentLink: vi.fn(),
  markPaymentAsPaid: vi.fn(),
  attachReceipt: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/receipt-upload', () => ({
  ReceiptUpload: () => <div data-testid="receipt-upload">ReceiptUpload</div>,
}));

vi.mock('@/components/reservations/add-payment-dialog', () => ({
  AddPaymentDialog: () => <div data-testid="add-payment-dialog">AddPaymentDialog</div>,
}));

vi.mock('@/components/reservations/send-payment-link-dialog', () => ({
  SendPaymentLinkDialog: () => <div data-testid="send-payment-link-dialog">SendPaymentLinkDialog</div>,
}));

const createMockPayment = (overrides: Record<string, any> = {}): Record<string, any> => ({
  id: 'payment-1',
  installmentIndex: undefined,
  amount: '50000',
  dueDate: null,
  status: 'COMPLETED',
  method: 'MERCADO_PAGO',
  initPoint: null,
  expiresAt: null,
  paidAt: '2025-01-15T10:00:00Z',
  deletedAt: null,
  receiptUrl: null,
  paymentType: 'RESERVATION',
  title: null,
  description: null,
  ...overrides,
});

const createMockReservation = (overrides: Record<string, any> = {}) => ({
  id: 'res-1',
  propertyId: 'prop-1',
  clientId: 'client-1',
  startDate: '2025-01-01',
  endDate: '2025-01-05',
  billingType: 'DAILY',
  unitsBooked: 1,
  totalPrice: '200000',
  status: 'PENDING',
  bookingAirbnb: false,
  notes: null,
  property: { id: 'prop-1', name: 'Test Property', color: '#3B82F6', dailyPrice: '50000' },
  client: { id: 'client-1', name: 'Test Client', email: 'test@test.com' },
  payments: [],
  ...overrides,
});

describe('PaymentsSection - paymentType separation', () => {
  it('shows "Pagos de reserva" title for DAILY billing', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    expect(screen.getByText('Pagos de reserva')).toBeTruthy();
  });

  it('shows "Cuotas de arriendo" title for MONTHLY billing', () => {
    const reservation = createMockReservation({
      billingType: 'MONTHLY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    expect(screen.getByText('Cuotas de arriendo')).toBeTruthy();
  });

  it('shows "Cobros extra" section when extra payments exist', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p2', amount: '10000', status: 'COMPLETED', paymentType: 'EXTRA' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    expect(screen.getByText('Cobros extra')).toBeTruthy();
  });

  it('does not show "Cobros extra" section when no extra payments', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    expect(screen.queryByText('Cobros extra')).toBeNull();
  });

  it('shows both tables when reservation and extra payments exist', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p2', amount: '10000', status: 'COMPLETED', paymentType: 'EXTRA' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    expect(screen.getByText('Pagos de reserva')).toBeTruthy();
    expect(screen.getByText('Cobros extra')).toBeTruthy();
  });

  it('calculates paidAmount from RESERVATION COMPLETED payments only', () => {
    const reservation = createMockReservation({
      billingType: 'DAILY',
      totalPrice: '200000',
      payments: [
        createMockPayment({ id: 'p1', amount: '50000', status: 'COMPLETED', paymentType: 'RESERVATION' }),
        createMockPayment({ id: 'p2', amount: '40000', status: 'COMPLETED', paymentType: 'EXTRA' }),
        createMockPayment({ id: 'p3', amount: '30000', status: 'PENDING', paymentType: 'RESERVATION' }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    // paidAmount should only count RESERVATION COMPLETED payments:
    // p1 ($50k RESERVATION COMPLETED) counts, p2 ($40k EXTRA) and p3 ($30k PENDING) don't.
    // 200000 total - 50000 paid = 150000 pending (shown in KpiCard + "Saldo pendiente" focus card).
    expect(screen.getAllByText('$150.000').length).toBeGreaterThanOrEqual(1);
  });
});

describe('PaymentsSection - empty state', () => {
  it('muestra empty state rico en la tabla de pagos cuando payments está vacío y reserva activa', () => {
    const reservation = createMockReservation({ status: 'PENDING', payments: [] });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText('Aún no hay pagos registrados')).toBeTruthy();
    // "Agregar Pago" aparece en el header + empty state + focus card (3×) porque
    // pendingAmount = totalPrice cuando no hay pagos: el focus card muestra "Agregar Pago"
    // ya que no hay MERCADO_PAGO pendientes sin initPoint (BUG-3 fix).
    expect(screen.getAllByRole('button', { name: /agregar pago/i })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /verificar/i })).toBeNull();
  });

  it('muestra empty state sin CTA cuando la reserva está cancelada y sin pagos', () => {
    const reservation = createMockReservation({ status: 'CANCELLED', payments: [] });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText('Esta reserva no tiene pagos registrados.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /agregar pago/i })).toBeNull();
  });

  it('muestra empty state con CTA cuando la reserva está CONFIRMED sin pagos', () => {
    // CONFIRMED es activo (mismo tratamiento que PENDING): la reserva ya está
    // cobrada y se pueden seguir registrando pagos parciales / extras.
    const reservation = createMockReservation({ status: 'CONFIRMED', payments: [] });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText('Aún no hay pagos registrados')).toBeTruthy();
    // "Agregar Pago" aparece en el header + empty state + focus card (3×) porque
    // pendingAmount = totalPrice cuando no hay pagos: el focus card muestra "Agregar Pago"
    // ya que no hay MERCADO_PAGO pendientes sin initPoint (BUG-3 fix).
    expect(screen.getAllByRole('button', { name: /agregar pago/i })).toHaveLength(3);
  });

  it('muestra empty state sin CTA cuando la reserva está COMPLETED sin pagos', () => {
    // COMPLETED es inactivo (mismo tratamiento que CANCELLED): no se permiten
    // nuevos pagos sobre una reserva cerrada.
    const reservation = createMockReservation({ status: 'COMPLETED', payments: [] });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText('Esta reserva no tiene pagos registrados.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /agregar pago/i })).toBeNull();
  });
});

describe('PaymentsSection - overdue KPI', () => {
  it('muestra KPI "Vencido" cuando hay pagos pendientes con dueDate pasada', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const reservation = createMockReservation({
      status: 'PENDING',
      payments: [
        createMockPayment({
          id: 'p1',
          amount: '50000',
          status: 'PENDING',
          paymentType: 'RESERVATION',
          dueDate: yesterday.toISOString(),
        }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    // El KPI Vencido es un group con aria-label="Vencido"; buscamos el span de valor
    // dentro de ese group para ser específicos y no chocar con la tabla de pagos.
    const vencidoCard = screen.getByRole('group', { name: 'Vencido' });
    expect(vencidoCard).toBeTruthy();
    expect(within(vencidoCard).getByText('$50.000')).toBeTruthy();
  });

  it('muestra $0 en KPI Vencido cuando no hay pagos vencidos', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const reservation = createMockReservation({
      status: 'PENDING',
      payments: [
        createMockPayment({
          id: 'p1',
          amount: '50000',
          status: 'PENDING',
          paymentType: 'RESERVATION',
          dueDate: tomorrow.toISOString(),
        }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    // Vencido muestra $0 cuando no hay pagos vencidos
    const vencidoCard = screen.getByRole('group', { name: 'Vencido' });
    expect(within(vencidoCard).getByText('$0')).toBeTruthy();
  });

  it('no cuenta como vencido un pago con dueDate null', () => {
    const reservation = createMockReservation({
      status: 'PENDING',
      payments: [
        createMockPayment({
          id: 'p1',
          amount: '50000',
          status: 'PENDING',
          paymentType: 'RESERVATION',
          dueDate: null,
        }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    // Sin dueDate no hay forma de saber si está vencido → KPI debe ser $0
    const vencidoCard = screen.getByRole('group', { name: 'Vencido' });
    expect(within(vencidoCard).getByText('$0')).toBeTruthy();
  });

  it('no cuenta como vencido un pago EXTRA con dueDate pasada', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const reservation = createMockReservation({
      status: 'PENDING',
      payments: [
        createMockPayment({
          id: 'p1',
          amount: '50000',
          status: 'PENDING',
          paymentType: 'EXTRA',
          title: 'Limpieza',
          dueDate: yesterday.toISOString(),
        }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    // Los EXTRAs no cuentan para el saldo del arriendo → KPI Vencido = $0
    const vencidoCard = screen.getByRole('group', { name: 'Vencido' });
    expect(within(vencidoCard).getByText('$0')).toBeTruthy();
  });

  it('no cuenta como vencido un pago soft-deleted', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const reservation = createMockReservation({
      status: 'PENDING',
      payments: [
        createMockPayment({
          id: 'p1',
          amount: '50000',
          status: 'PENDING',
          paymentType: 'RESERVATION',
          dueDate: yesterday.toISOString(),
          deletedAt: '2025-01-01T00:00:00.000Z',
        }),
      ],
    });

    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );

    // Soft-deleted se excluye (auditoría) → KPI Vencido = $0
    const vencidoCard = screen.getByRole('group', { name: 'Vencido' });
    expect(within(vencidoCard).getByText('$0')).toBeTruthy();
  });
});


describe("PaymentsSection - 10 states from issue #218 brief", () => {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);
  const nextMonth = new Date(today); nextMonth.setMonth(today.getMonth() + 1);

  // Helper to create a reservation with payments
  const makeReservation = (overrides = {}) => {
    const res = {
      id: "res-1",
      propertyId: "prop-1",
      clientId: "client-1",
      startDate: "2025-01-01",
      endDate: "2025-01-05",
      billingType: "DAILY",
      unitsBooked: 1,
      totalPrice: "200000",
      status: "PENDING",
      bookingAirbnb: false,
      notes: null,
      property: { id: "prop-1", name: "Test Property", color: "#3B82F6", dailyPrice: "50000" },
      client: { id: "client-1", name: "Test Client", email: "test@test.com" },
      payments: [],
      ...overrides,
    };
    return res;
  };

  const makePayment = (overrides = {}) => ({
    id: "pay-1",
    installmentIndex: null,
    amount: "50000",
    dueDate: null,
    status: "PENDING",
    method: "MERCADO_PAGO",
    initPoint: null,
    expiresAt: null,
    paidAt: null,
    deletedAt: null,
    receiptUrl: null,
    paymentType: "RESERVATION",
    title: null,
    description: null,
    installmentLabel: null,
    ...overrides,
  });

  // STATE 1: MONTHLY 1 pagada + resto pendiente
  it("MONTHLY 1 cuota pagada + resto pendiente — timeline con primera success, otras info", () => {
    const reservation = makeReservation({
      billingType: "MONTHLY",
      status: "CONFIRMED",
      totalPrice: "300000",
      payments: [
        makePayment({ id: "p1", installmentIndex: 1, status: "COMPLETED", paidAt: yesterday.toISOString(), dueDate: yesterday.toISOString() }),
        makePayment({ id: "p2", installmentIndex: 2, status: "PENDING", dueDate: tomorrow.toISOString() }),
        makePayment({ id: "p3", installmentIndex: 3, status: "PENDING", dueDate: nextMonth.toISOString() }),
      ],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText("Cuotas de arriendo")).toBeTruthy();
    // Title shows MONTHLY + timeline nodes use "Cuota X de Y" eyebrows
    expect(screen.getAllByText(/cuota/i).length).toBeGreaterThan(0);
    // Has timeline nodes (3)
    const nodes = document.querySelectorAll("[data-testid^=\"timeline-node-\"]");
    expect(nodes.length).toBe(3);
  });

  // STATE 2: MONTHLY todo pagado
  it("MONTHLY todo pagado — timeline completo success, sin focus card, celebratorio", () => {
    const reservation = makeReservation({
      billingType: "MONTHLY",
      status: "COMPLETED",
      totalPrice: "300000",
      payments: [
        makePayment({ id: "p1", installmentIndex: 1, status: "COMPLETED", paidAt: yesterday.toISOString() }),
        makePayment({ id: "p2", installmentIndex: 2, status: "COMPLETED", paidAt: yesterday.toISOString() }),
        makePayment({ id: "p3", installmentIndex: 3, status: "COMPLETED", paidAt: yesterday.toISOString() }),
      ],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText("Cuotas pagadas en su totalidad")).toBeTruthy();
    // No focus card for overdue
    expect(screen.queryByText(/tienes.*cuota.*vencida/i)).toBeNull();
  });

  // STATE 3: MONTHLY 2+ vencidas
  it("MONTHLY 2+ vencidas — focus card + nodos destructive", () => {
    const reservation = makeReservation({
      billingType: "MONTHLY",
      status: "CONFIRMED",
      totalPrice: "300000",
      payments: [
        makePayment({ id: "p1", installmentIndex: 1, status: "COMPLETED", paidAt: yesterday.toISOString() }),
        makePayment({ id: "p2", installmentIndex: 2, status: "PENDING", dueDate: twoDaysAgo.toISOString() }),
        makePayment({ id: "p3", installmentIndex: 3, status: "PENDING", dueDate: yesterday.toISOString() }),
      ],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    // Focus card visible
    expect(screen.getByText(/tienes 2 cuotas vencidas/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /ir a la primera cuota vencida/i })).toBeTruthy();
    // CTA Marcar pagado on nodes
    const nodes = document.querySelectorAll("[data-testid^=\"timeline-node-\"]");
    expect(nodes.length).toBe(3);
  });

  // STATE 4: DAILY 0 pagos activa
  it("DAILY 0 pagos y reserva activa — empty state + CTA Agregar Pago", () => {
    const reservation = makeReservation({ status: "PENDING", payments: [] });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText("A\u00fan no hay pagos registrados")).toBeTruthy();
    // 3x "Agregar Pago" (header + empty state + focus card). Focus card aparece porque
    // pendingAmount = totalPrice cuando no hay pagos y no hay MERCADO_PAGO pendientes
    // sin initPoint → CTA es "Agregar Pago" (BUG-3 fix).
    expect(screen.getAllByRole("button", { name: /agregar pago/i })).toHaveLength(3);
  });

  // STATE 5: DAILY 1 pago completo
  it("DAILY 1 pago completo — card success + celebratorio", () => {
    const reservation = makeReservation({
      status: "COMPLETED",
      totalPrice: "50000",
      payments: [makePayment({ id: "p1", status: "COMPLETED", paidAt: yesterday.toISOString() })],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText("Pago cobrado · $50.000")).toBeTruthy();
    // Sin focus card Saldo pendiente
    expect(screen.queryByText("Saldo pendiente")).toBeNull();
  });

  // STATE 6: DAILY 1 pago parcial
  it("DAILY 1 pago parcial — focus card Saldo pendiente + CTA", () => {
    const reservation = makeReservation({
      status: "CONFIRMED",
      totalPrice: "100000",
      payments: [makePayment({ id: "p1", status: "PENDING", amount: "30000" })],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText("Saldo pendiente")).toBeTruthy();
    expect(screen.getByRole("button", { name: /generar link de mercado pago/i })).toBeTruthy();
  });

  // STATE 7: DAILY varios parciales
  it("DAILY varios parciales — lista cronologica + focus card", () => {
    const reservation = makeReservation({
      status: "CONFIRMED",
      totalPrice: "200000",
      payments: [
        makePayment({ id: "p1", status: "PENDING", amount: "30000" }),
        makePayment({ id: "p2", status: "PENDING", amount: "40000" }),
        makePayment({ id: "p3", status: "FAILED", amount: "20000" }),
      ],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText("Saldo pendiente")).toBeTruthy();
    const cards = document.querySelectorAll("[data-testid^=\"payment-card-\"]");
    expect(cards.length).toBe(3);
  });

  // STATE 8: CANCELLED
  it("CANCELLED reserva — sin acciones, tone muted", () => {
    const reservation = makeReservation({
      status: "CANCELLED",
      totalPrice: "200000",
      payments: [makePayment({ id: "p1", status: "COMPLETED", paidAt: yesterday.toISOString() })],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    // Sin "Agregar Pago" en header
    expect(screen.queryByRole("button", { name: /agregar pago/i })).toBeNull();
    // El card sigue visible con opacity-60
    const card = document.querySelector("[data-testid^=\"payment-card-\"]");
    expect(card?.closest("article")?.className).toContain("opacity-60");
  });

  // STATE 9: COMPLETED
  it("COMPLETED reserva — sin acciones, sin CTA primario", () => {
    const reservation = makeReservation({
      status: "COMPLETED",
      totalPrice: "200000",
      payments: [makePayment({ id: "p1", status: "COMPLETED", paidAt: yesterday.toISOString() })],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.queryByRole("button", { name: /agregar pago/i })).toBeNull();
    // Celebratorio visible
    expect(screen.getByText("Pago cobrado · $50.000")).toBeTruthy();
  });

  // STATE 10: Con cobros extra
  it("Con cobros extra — subseccion Cobros extra con cards separadas", () => {
    const reservation = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      totalPrice: "100000",
      payments: [
        makePayment({ id: "p1", status: "COMPLETED", paymentType: "RESERVATION" }),
        makePayment({ id: "p2", status: "PENDING", paymentType: "EXTRA", title: "Limpieza extra" }),
        makePayment({ id: "p3", status: "PENDING", paymentType: "EXTRA", title: "Multa" }),
      ],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByText("Cobros extra")).toBeTruthy();
    // Extra payments rendered as cards
    const allCards = document.querySelectorAll("[data-testid^=\"payment-card-\"]");
    expect(allCards.length).toBe(3); // 1 reservation + 2 extra
  });
});

describe("PaymentsSection - gating del boton Verificar pagos MP", () => {
  const makeReservation = (overrides = {}) => ({
    id: "res-1",
    propertyId: "prop-1",
    clientId: "client-1",
    startDate: "2025-01-01",
    endDate: "2025-01-05",
    billingType: "DAILY",
    unitsBooked: 1,
    totalPrice: "200000",
    status: "CONFIRMED",
    bookingAirbnb: false,
    notes: null,
    property: { id: "prop-1", name: "Test Property", color: "#3B82F6", dailyPrice: "50000" },
    client: { id: "client-1", name: "Test Client", email: "test@test.com" },
    payments: [],
    ...overrides,
  });

  const makePayment = (overrides = {}) => ({
    id: "pay-1",
    installmentIndex: null,
    amount: "50000",
    dueDate: null,
    status: "PENDING",
    method: "CASH",
    initPoint: null,
    expiresAt: null,
    paidAt: null,
    deletedAt: null,
    receiptUrl: null,
    paymentType: "RESERVATION",
    title: null,
    description: null,
    installmentLabel: null,
    ...overrides,
  });

  it("CASH payments — boton Verificar NO aparece", () => {
    const reservation = makeReservation({
      payments: [makePayment({ id: "p1", method: "CASH" })],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.queryByRole("button", { name: /verificar pagos mp/i })).toBeNull();
  });

  it("MERCADOPAGO PENDING — boton Verificar aparece con label Verificar pagos MP", () => {
    const reservation = makeReservation({
      payments: [makePayment({ id: "p1", method: "MERCADO_PAGO", status: "PENDING" })],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByRole("button", { name: /verificar pagos mp/i })).toBeTruthy();
  });

  it("MERCADOPAGO COMPLETED — boton Verificar aparece (revalidar links)", () => {
    const reservation = makeReservation({
      status: "CONFIRMED",
      payments: [makePayment({ id: "p1", method: "MERCADO_PAGO", status: "COMPLETED", paidAt: new Date().toISOString() })],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.getByRole("button", { name: /verificar pagos mp/i })).toBeTruthy();
  });

  it("CANCELLED + MERCADOPAGO — boton NO aparece (gating por isActive)", () => {
    const reservation = makeReservation({
      status: "CANCELLED",
      payments: [makePayment({ id: "p1", method: "MERCADO_PAGO", status: "PENDING" })],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.queryByRole("button", { name: /verificar pagos mp/i })).toBeNull();
  });

  it("COMPLETED reserva + MERCADOPAGO — boton NO aparece (gating por isActive)", () => {
    const reservation = makeReservation({
      status: "COMPLETED",
      payments: [makePayment({ id: "p1", method: "MERCADO_PAGO", status: "COMPLETED" })],
    });
    render(
      <PaymentsSection
        reservationId={reservation.id}
        totalPrice={reservation.totalPrice}
        billingType={reservation.billingType}
        status={reservation.status}
        payments={reservation.payments}
        client={reservation.client}
        propertyName="Test Property"
      />
    );
    expect(screen.queryByRole("button", { name: /verificar pagos mp/i })).toBeNull();
  });
});
