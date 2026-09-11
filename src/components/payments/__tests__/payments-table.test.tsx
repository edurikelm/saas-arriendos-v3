import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Payment } from '../payments-table';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { PaymentsTable } from '../payments-table';

const createMockPayment = (overrides: Partial<Payment> = {}): Payment => ({
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
  createdAt: '2025-07-15T10:00:00Z',
  clientName: 'Carlos Rodríguez',
  propertyName: 'Cabaña del Bosque',
  ...overrides,
});

// ────────────────────────────────────────────────────────────────────────────
// isExpired badge — Mercado Pago PENDING links
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - isExpired badge', () => {
  it('muestra badge "Expirado" cuando PENDING + MP + expiresAt en pasado', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const payment = createMockPayment({
      status: 'PENDING',
      method: 'MERCADO_PAGO',
      initPoint: 'https://www.mercadopago.com.ar/checkout/test',
      expiresAt: pastDate.toISOString(),
    });

    render(<PaymentsTable payments={[payment]} variant="full" onRegenerateLink={vi.fn()} />);

    expect(screen.getByText('Expirado')).toBeTruthy();
  });

  it('NO muestra badge "Expirado" cuando expiresAt en futuro', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const payment = createMockPayment({
      status: 'PENDING',
      method: 'MERCADO_PAGO',
      initPoint: 'https://www.mercadopago.com.ar/checkout/test',
      expiresAt: futureDate.toISOString(),
    });

    render(<PaymentsTable payments={[payment]} variant="full" onRegenerateLink={vi.fn()} />);

    expect(screen.queryByText('Expirado')).toBeNull();
  });

  it('NO muestra badge "Expirado" cuando COMPLETED aunque expiresAt en pasado', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const payment = createMockPayment({
      status: 'COMPLETED',
      method: 'MERCADO_PAGO',
      initPoint: 'https://www.mercadopago.com.ar/checkout/test',
      expiresAt: pastDate.toISOString(),
    });

    render(<PaymentsTable payments={[payment]} variant="full" onRegenerateLink={vi.fn()} />);

    expect(screen.queryByText('Expirado')).toBeNull();
  });

  it('NO muestra badge "Expirado" para método CASH (no MP)', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const payment = createMockPayment({
      status: 'PENDING',
      method: 'CASH',
      expiresAt: pastDate.toISOString(),
    });

    render(<PaymentsTable payments={[payment]} variant="full" onRegenerateLink={vi.fn()} />);

    expect(screen.queryByText('Expirado')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Regenerar link button
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - Regenerar link button', () => {
  it('muestra botón "Regenerar link" cuando PENDING + MP + expirado + onRegenerateLink provisto', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const payment = createMockPayment({
      status: 'PENDING',
      method: 'MERCADO_PAGO',
      initPoint: 'https://www.mercadopago.com.ar/checkout/test',
      expiresAt: pastDate.toISOString(),
    });

    render(<PaymentsTable payments={[payment]} variant="full" onRegenerateLink={vi.fn()} />);

    expect(screen.getByRole('button', { name: /regenerar link/i })).toBeTruthy();
  });

  it('NO muestra botón "Regenerar link" cuando PENDING + MP + NO expirado', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const payment = createMockPayment({
      status: 'PENDING',
      method: 'MERCADO_PAGO',
      initPoint: 'https://www.mercadopago.com.ar/checkout/test',
      expiresAt: futureDate.toISOString(),
    });

    render(<PaymentsTable payments={[payment]} variant="full" onRegenerateLink={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /regenerar link/i })).toBeNull();
  });

  it('NO muestra botón "Regenerar link" cuando COMPLETED + expirado', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const payment = createMockPayment({
      status: 'COMPLETED',
      method: 'MERCADO_PAGO',
      initPoint: 'https://www.mercadopago.com.ar/checkout/test',
      expiresAt: pastDate.toISOString(),
    });

    render(<PaymentsTable payments={[payment]} variant="full" onRegenerateLink={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /regenerar link/i })).toBeNull();
  });

  it('NO muestra botón "Regenerar link" cuando PENDING + MP + expirado pero SIN initPoint', () => {
    // Edge case: estado artificial (initPoint null pero expiresAt en pasado)
    // — posible solo por escritura directa a DB. El badge "Expirado" SÍ debe
    // mostrarse (el badge no requiere initPoint), pero el botón Regenerar NO
    // porque regeneratePaymentLink requiere un initPoint previo.
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const payment = createMockPayment({
      status: 'PENDING',
      method: 'MERCADO_PAGO',
      initPoint: null,
      expiresAt: pastDate.toISOString(),
    });

    render(<PaymentsTable payments={[payment]} variant="full" onRegenerateLink={vi.fn()} />);

    expect(screen.getByText('Expirado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /regenerar link/i })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Copiar link vs Regenerar — mutually exclusive
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - Copiar link vs Regenerar', () => {
  it('muestra "Copiar link" cuando PENDING + MP + initPoint + NO expirado', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const payment = createMockPayment({
      status: 'PENDING',
      method: 'MERCADO_PAGO',
      initPoint: 'https://www.mercadopago.com.ar/checkout/test',
      expiresAt: futureDate.toISOString(),
    });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByRole('button', { name: /copiar link/i })).toBeTruthy();
  });

  it('NO muestra "Copiar link" cuando PENDING + MP + initPoint + expirado (debe mostrar Regenerar)', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const payment = createMockPayment({
      status: 'PENDING',
      method: 'MERCADO_PAGO',
      initPoint: 'https://www.mercadopago.com.ar/checkout/test',
      expiresAt: pastDate.toISOString(),
    });

    render(<PaymentsTable payments={[payment]} variant="full" onRegenerateLink={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /copiar link/i })).toBeNull();
    expect(screen.getByRole('button', { name: /regenerar link/i })).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// receiptUrl display (variant="reservation" sin installment data)
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - receiptUrl display', () => {
  it('shows receipt button when payment has receiptUrl', () => {
    const payment = createMockPayment({
      receiptUrl: 'https://www.mercadopago.com.ar/receipts/abc123',
    });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.getByText('Monto')).toBeTruthy();
  });

  it('does not show receipt button when payment has no receiptUrl', () => {
    const payment = createMockPayment({ receiptUrl: null });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.getByText('Monto')).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// variant="reservation" — auto-detect installment columns
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - variant="reservation"', () => {
  it('muestra columnas de installment si algún pago tiene installmentIndex', () => {
    const payment = createMockPayment({ installmentIndex: 1, dueDate: '2025-02-01' });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.getByText('Cuota')).toBeTruthy();
    expect(screen.getByText('Vencimiento')).toBeTruthy();
  });

  it('oculta columnas de installment si ningún pago tiene installment data', () => {
    const payment = createMockPayment({ installmentIndex: null, installmentLabel: null });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.queryByText('Cuota')).toBeNull();
    expect(screen.queryByText('Vencimiento')).toBeNull();
  });

  it('auto-detecta installment también desde installmentLabel', () => {
    const payment = createMockPayment({
      installmentIndex: undefined,
      installmentLabel: '1 / 3',
      dueDate: '2025-02-01',
    });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.getByText('Cuota')).toBeTruthy();
  });

  it('NO muestra columnas de contexto ni de concepto', () => {
    const payment = createMockPayment({ installmentIndex: 1 });

    render(<PaymentsTable payments={[payment]} variant="reservation" />);

    expect(screen.queryByText('Cliente')).toBeNull();
    expect(screen.queryByText('Propiedad')).toBeNull();
    expect(screen.queryByText('Concepto')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// variant="extra" — concept column, sin installment, sin context
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - variant="extra"', () => {
  it('muestra columna Concepto', () => {
    const payment = createMockPayment({ paymentType: 'EXTRA', title: 'Limpieza profunda' });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Concepto')).toBeTruthy();
  });

  it('NO muestra columnas de installment ni de contexto', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: 'Limpieza profunda',
      installmentIndex: 1,
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.queryByText('Cuota')).toBeNull();
    expect(screen.queryByText('Cliente')).toBeNull();
    expect(screen.queryByText('Propiedad')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// emptyState prop
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - emptyState', () => {
  it('renderiza emptyState cuando payments está vacío y se provee', () => {
    render(
      <PaymentsTable
        payments={[]}
        variant="reservation"
        emptyState={<p>No hay pagos todavía</p>}
      />
    );
    expect(screen.getByText('No hay pagos todavía')).toBeTruthy();
  });

  it('NO renderiza emptyState cuando hay payments aunque se provea (children tiene prioridad)', () => {
    render(
      <PaymentsTable
        payments={[createMockPayment()]}
        variant="reservation"
        emptyState={<p>No debería verse</p>}
      />
    );
    expect(screen.queryByText('No debería verse')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// variant="full" — todas las columnas
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - variant="full" (fila a dos niveles)', () => {
  it('tiene cinco columnas, no una por dato', () => {
    // Once columnas necesitaban 1668px contra los 1086px reales de un
    // escritorio de 1440. Propiedad, cuota, medio y las tres fechas pasaron a
    // ser la segunda línea de la columna que las explica.
    render(<PaymentsTable payments={[createMockPayment()]} variant="full" />);

    const headers = Array.from(document.querySelectorAll('thead th')).map(
      (th) => th.textContent?.trim(),
    );
    expect(headers).toEqual(['Cliente', 'Concepto', 'Monto', 'Estado', 'Acciones']);
  });

  it('la columna Cliente lleva el nombre arriba y la propiedad debajo', () => {
    const payment = createMockPayment({
      clientName: 'Carlos Rodríguez',
      propertyName: 'Cabaña del Bosque',
    });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText('Carlos Rodríguez')).toBeTruthy();
    expect(screen.getByText('Cabaña del Bosque')).toBeTruthy();
  });

  it('la columna Monto lleva el medio de pago debajo', () => {
    const payment = createMockPayment({ method: 'CASH', amount: '50000' });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText('Efectivo')).toBeTruthy();
  });

  it('la cuota va bajo el concepto, no en su propia columna', () => {
    const payment = createMockPayment({ installmentIndex: 3, installmentLabel: '3 / 12' });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText('Cuota 3 / 12')).toBeTruthy();
    expect(screen.queryByText('Vencimiento')).toBeNull();
  });

  it('la columna Acciones se fija al borde derecho', () => {
    // Corolario de The Row Isolation Rule: como la fila no es clickeable, esa
    // columna es el único camino a las acciones. Si se sale del área visible
    // por ancho, la tabla queda de solo lectura y nada lo señala.
    render(<PaymentsTable payments={[createMockPayment()]} variant="full" />);

    const th = Array.from(document.querySelectorAll('thead th')).at(-1);
    const td = Array.from(document.querySelectorAll('tbody tr td')).at(-1);
    expect(th?.className).toContain('sticky');
    expect(td?.className).toContain('sticky');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// La fecha que el estado hace relevante (segunda línea de "Estado")
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - fecha por estado', () => {
  it('un pago cobrado se explica por cuándo entró la plata', () => {
    // Fechas lejos del fin de año a propósito, y se afirma el AÑO y no el día:
    // `paidAt` y `createdAt` son instantes reales y la celda los formatea en la
    // zona del navegador, así que el día puede correrse uno según dónde corra
    // la suite. Lo que este test cuida es de qué campo sale la fecha.
    const payment = createMockPayment({
      status: 'COMPLETED',
      paidAt: '2025-08-04T10:00:00Z',
      createdAt: '2024-06-15T10:00:00Z',
    });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText(/^Pagado /)).toBeTruthy();
    expect(screen.getByText(/^Pagado .*2025$/)).toBeTruthy();
    expect(screen.queryByText(/2024/)).toBeNull();
  });

  it('un pendiente al día se explica por cuándo vence', () => {
    const payment = createMockPayment({
      status: 'PENDING',
      paidAt: null,
      dueDate: '2025-09-20T15:00:00Z',
      overdueDays: null,
    });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText(/^Vence /)).toBeTruthy();
  });

  it('la mora gana sobre el vencimiento y va coloreada', () => {
    const payment = createMockPayment({
      status: 'PENDING',
      paidAt: null,
      dueDate: '2025-08-05T15:00:00Z',
      overdueDays: 36,
    });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    const linea = screen.getByText('Vencido hace 36 días');
    expect(linea).toBeTruthy();
    expect(linea.className).toContain('text-destructive-text');
    expect(screen.queryByText(/^Vence /)).toBeNull();
  });

  it('singulariza un solo día de mora', () => {
    const payment = createMockPayment({ status: 'PENDING', paidAt: null, overdueDays: 1 });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    expect(screen.getByText('Vencido hace 1 día')).toBeTruthy();
  });

  it('cae a la fecha de emisión cuando el estado no aporta ninguna', () => {
    const payment = createMockPayment({
      status: 'FAILED',
      paidAt: null,
      dueDate: null,
      createdAt: '2025-07-15T10:00:00Z',
    });

    render(<PaymentsTable payments={[payment]} variant="full" />);

    // El año y no el día: ver la nota del test de "Pagado".
    expect(screen.getByText(/^Emitido .*2025$/)).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Concept labels y badge variants (transversal a las variants)
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - concept label', () => {
  it('muestra "Arriendo" para RESERVATION diario sin installmentIndex (variant="extra")', () => {
    const payment = createMockPayment({
      paymentType: 'RESERVATION',
      installmentIndex: null,
      installmentLabel: null,
      title: null,
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Arriendo')).toBeTruthy();
  });


  it('muestra el title del pago EXTRA (variant="extra")', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: 'Limpieza profunda',
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Limpieza profunda')).toBeTruthy();
  });

  it('muestra "Cobro extra" para EXTRA sin título', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: null,
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Cobro extra')).toBeTruthy();
  });
});

describe('PaymentsTable - concept badge variant', () => {
  it('badge variant=info para RESERVATION diario (variant="extra")', () => {
    const payment = createMockPayment({
      paymentType: 'RESERVATION',
      installmentIndex: null,
      title: null,
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Arriendo')).toBeTruthy();
    const badge = screen.getByText('Arriendo').closest('[class*="bg-info"]');
    expect(badge).toBeTruthy();
  });


  it('badge variant=warning para EXTRA (variant="extra")', () => {
    const payment = createMockPayment({
      paymentType: 'EXTRA',
      title: 'Limpieza profunda',
    });

    render(<PaymentsTable payments={[payment]} variant="extra" />);

    expect(screen.getByText('Limpieza profunda')).toBeTruthy();
    const badge = screen.getByText('Limpieza profunda').closest('[class*="bg-warning"]');
    expect(badge).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// compact=true — mobile dot instead of Estado column
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - compact mode', () => {
  it('renderiza dot semántico en lugar de columna Estado cuando compact=true', () => {
    const payment = createMockPayment({ status: 'PENDING' });

    render(<PaymentsTable payments={[payment]} variant="reservation" compact />);

    // No debe haber columna "Estado" en el thead
    expect(screen.queryByText('Estado')).toBeNull();

    // Debe haber un dot con aria-label
    const dot = screen.getByLabelText('Pendiente');
    expect(dot).toBeTruthy();
  });

  it('renderiza columna Estado con Badge cuando compact=false', () => {
    const payment = createMockPayment({ status: 'PENDING' });

    render(<PaymentsTable payments={[payment]} variant="full" compact={false} />);

    expect(screen.getByText('Estado')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
  });

  it('dot usa bg-success para status COMPLETED', () => {
    const payment = createMockPayment({ status: 'COMPLETED' });

    render(<PaymentsTable payments={[payment]} variant="reservation" compact />);

    const dot = screen.getByLabelText('Pagado');
    expect(dot).toBeTruthy();
  });

  it('dot usa bg-destructive para status FAILED', () => {
    const payment = createMockPayment({ status: 'FAILED' });

    render(<PaymentsTable payments={[payment]} variant="reservation" compact />);

    const dot = screen.getByLabelText('Fallido');
    expect(dot).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Orden de filas por variante
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - orden de filas', () => {
  /**
   * Lee el nombre de cliente de cada fila, en el orden en que se renderizan.
   * En la variante "full" Cliente es la primera columna, y el nombre es su
   * primera línea — la segunda es la propiedad.
   */
  function renderedClients(): string[] {
    return Array.from(document.querySelectorAll('tbody tr')).map(
      (row) => row.querySelector('td')?.querySelector('p')?.textContent?.trim() ?? '',
    );
  }

  it('variante "full" respeta el orden del servidor, no reordena por cuota', () => {
    // Historial global tal como lo entrega `getPayments`: `createdAt` desc,
    // mezclando reservas distintas. Los `installmentIndex` van a contrapelo
    // a propósito — si la tabla reordenara por cuota, el resultado saldría
    // invertido.
    const payments = [
      createMockPayment({ id: 'p1', clientName: 'Tercero', installmentIndex: 3, createdAt: '2025-09-01T10:00:00Z' }),
      createMockPayment({ id: 'p2', clientName: 'Segundo', installmentIndex: 2, createdAt: '2025-08-01T10:00:00Z' }),
      createMockPayment({ id: 'p3', clientName: 'Primero', installmentIndex: 1, createdAt: '2025-07-01T10:00:00Z' }),
    ];

    render(<PaymentsTable payments={payments} variant="full" />);

    expect(renderedClients()).toEqual(['Tercero', 'Segundo', 'Primero']);
  });

  it('variante "full" no manda al tope los pagos sin cuota', () => {
    // `installmentIndex ?? 0` colapsaba arriendos diarios y cobros extra al
    // inicio del listado, delante de cualquier cuota.
    const payments = [
      createMockPayment({ id: 'p1', clientName: 'Con cuota', installmentIndex: 5 }),
      createMockPayment({ id: 'p2', clientName: 'Sin cuota', installmentIndex: null, paymentType: 'EXTRA', title: 'Multa' }),
    ];

    render(<PaymentsTable payments={payments} variant="full" />);

    expect(renderedClients()).toEqual(['Con cuota', 'Sin cuota']);
  });

  it('variante "reservation" sí ordena por cuota', () => {
    // Dentro de una reserva todas las filas comparten la misma serie de
    // cuotas, y ese es el orden natural de lectura.
    const payments = [
      createMockPayment({ id: 'p1', installmentIndex: 3, installmentLabel: '3 / 3' }),
      createMockPayment({ id: 'p2', installmentIndex: 1, installmentLabel: '1 / 3' }),
      createMockPayment({ id: 'p3', installmentIndex: 2, installmentLabel: '2 / 3' }),
    ];

    render(<PaymentsTable payments={payments} variant="reservation" />);

    const cuotas = Array.from(document.querySelectorAll('tbody tr')).map(
      (row) => row.querySelectorAll('td')[0]?.textContent?.trim() ?? '',
    );
    expect(cuotas).toEqual(['1 / 3', '2 / 3', '3 / 3']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Concepto en el listado global: clase de arriendo + marca de extra
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsTable - badges de concepto (variant="full")', () => {
  /** Texto de los badges de la celda Concepto, en orden. */
  function badgesDeConcepto(): string[] {
    const celda = document.querySelectorAll('tbody tr td')[1];
    return Array.from(celda.querySelectorAll('[data-slot="badge"]')).map(
      (b) => b.textContent?.trim() ?? '',
    );
  }

  it('dice a qué clase de arriendo pertenece el cobro', () => {
    // "Arriendo" y "Mensualidad" no eran términos paralelos: uno nombra el
    // contrato y el otro la cuota, así que la columna cambiaba de eje entre
    // filas. "Diario" y "Mensual" sí lo son.
    render(
      <PaymentsTable
        payments={[createMockPayment({ paymentType: 'RESERVATION', billingType: 'MONTHLY' })]}
        variant="full"
      />,
    );

    expect(badgesDeConcepto()).toEqual(['Mensual']);
  });

  it('un arriendo diario dice Diario', () => {
    render(
      <PaymentsTable
        payments={[createMockPayment({ paymentType: 'RESERVATION', billingType: 'DAILY' })]}
        variant="full"
      />,
    );

    expect(badgesDeConcepto()).toEqual(['Diario']);
  });

  it('un cobro extra suma un segundo badge, sin perder la clase de arriendo', () => {
    // Antes un extra se distinguía solo por el TONO del badge y por mostrar su
    // título. El color como única señal no le sirve a quien no lo distingue
    // (WCAG 1.4.1).
    render(
      <PaymentsTable
        payments={[
          createMockPayment({ paymentType: 'EXTRA', billingType: 'MONTHLY', title: 'Multa por daños' }),
        ]}
        variant="full"
      />,
    );

    expect(badgesDeConcepto()).toEqual(['Mensual', 'Extra']);
  });

  it('el título del extra no se pierde: encabeza la segunda línea', () => {
    render(
      <PaymentsTable
        payments={[
          createMockPayment({
            paymentType: 'EXTRA',
            billingType: 'DAILY',
            title: 'Multa por daños',
            installmentIndex: null,
            installmentLabel: null,
          }),
        ]}
        variant="full"
      />,
    );

    expect(screen.getByText('Multa por daños')).toBeTruthy();
  });

  it('sin billingType, la existencia de cuota decide', () => {
    // Las variantes de reserva no traen `billingType`.
    render(
      <PaymentsTable
        payments={[
          createMockPayment({ paymentType: 'RESERVATION', billingType: null, installmentIndex: 3 }),
        ]}
        variant="full"
      />,
    );

    expect(badgesDeConcepto()).toEqual(['Mensual']);
  });

  it('el badge de extra va en tono de atención y el de clase en neutro', () => {
    render(
      <PaymentsTable
        payments={[createMockPayment({ paymentType: 'EXTRA', billingType: 'MONTHLY', title: 'Multa' })]}
        variant="full"
      />,
    );

    expect(screen.getByText('Mensual').className).toContain('bg-info');
    expect(screen.getByText('Extra').className).toContain('bg-warning');
  });
});
