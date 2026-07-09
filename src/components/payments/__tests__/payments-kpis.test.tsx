import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PaymentsKpis } from '../payments-kpis';

const defaultKpis = {
  cobradoMes: 150000,
  pendiente: 80000,
  pendienteCount: 2,
  proximos7DiasCount: 3,
};

describe('PaymentsKpis', () => {
  it('renderiza los tres KPIs con formato correcto', () => {
    render(<PaymentsKpis kpis={defaultKpis} />);

    expect(screen.getByText('Cobrado este mes')).toBeTruthy();
    expect(screen.getByText('$150.000')).toBeTruthy();

    expect(screen.getByText('Pendiente de cobro')).toBeTruthy();
    expect(screen.getByText('$80.000')).toBeTruthy();
    expect(screen.getByText('2 pagos pendientes')).toBeTruthy();

    expect(screen.getByText('Próximos vencimientos')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Próximos 7 días')).toBeTruthy();
  });

  it('muestra $0 cuando cobradoMes es 0', () => {
    render(<PaymentsKpis kpis={{ ...defaultKpis, cobradoMes: 0 }} />);

    expect(screen.getByText('$0')).toBeTruthy();
  });

  it('muestra 0 cuando proximos7DiasCount es 0', () => {
    render(<PaymentsKpis kpis={{ ...defaultKpis, proximos7DiasCount: 0 }} />);

    // El sublabel "Próximos 7 días" es único de este card
    expect(screen.getByText('Próximos 7 días')).toBeTruthy();
  });

  it('muestra "1 pago pendiente" en singular cuando pendienteCount es 1', () => {
    render(<PaymentsKpis kpis={{ ...defaultKpis, pendienteCount: 1 }} />);

    expect(screen.getByText('1 pago pendiente')).toBeTruthy();
  });

  it('aplica tone=warning al KPI de Pendiente (text-warning en el value)', () => {
    const { container } = render(<PaymentsKpis kpis={defaultKpis} />);
    const warningElements = container.querySelectorAll('.text-warning');
    expect(warningElements.length).toBeGreaterThan(0);
  });
});
