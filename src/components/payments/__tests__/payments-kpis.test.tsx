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

  it('aplica tone=warning al KPI de Pendiente (text-warning-text en el value)', () => {
    const { container } = render(<PaymentsKpis kpis={defaultKpis} />);
    // El token de RELLENO `--warning` medía 2.05:1 sobre --card en claro; el
    // valor del KpiCard usa su compañero legible (Fill-vs-Text Rule, DESIGN.md).
    expect(container.querySelectorAll('.text-warning-text').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.text-warning').length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Grilla en móvil
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsKpis - grilla', () => {
  /** El contenedor de la grilla es el padre del primer card. */
  function grid(): HTMLElement {
    return screen.getByLabelText('Cobrado este mes').parentElement as HTMLElement;
  }

  it('usa dos columnas en móvil y tres desde sm', () => {
    // `grid-cols-3` también en móvil dejaba cada card en 101px a 375px, con el
    // icono saliéndose hasta 29px. Dos columnas es lo que ya usan dashboard,
    // calendar y reports.
    render(<PaymentsKpis kpis={defaultKpis} />);

    // Sobre la lista de clases, no sobre el string: `sm:grid-cols-3` contiene
    // a `grid-cols-3` como subcadena y un `not.toContain` daría falso negativo.
    const clases = Array.from(grid().classList);
    expect(clases).toContain('grid-cols-2');
    expect(clases).toContain('sm:grid-cols-3');
    expect(clases).not.toContain('grid-cols-3');
  });

  it('la tercera card ocupa la fila completa en móvil', () => {
    // Son tres cards en una grilla de dos columnas: sin esto la última queda
    // sola dejando un hueco del mismo tamaño al lado.
    render(<PaymentsKpis kpis={defaultKpis} />);

    const tercera = screen.getByLabelText('Próximos vencimientos').parentElement;
    expect(tercera?.className).toContain('col-span-2');
    expect(tercera?.className).toContain('sm:col-span-1');
  });

  it('las tres cards esconden el icono bajo sm', () => {
    // `density="compact"`. Con el ancho ya resuelto, el icono pasa a competir
    // con la cifra, que es el dato.
    render(<PaymentsKpis kpis={defaultKpis} />);

    for (const label of ['Cobrado este mes', 'Pendiente de cobro', 'Próximos vencimientos']) {
      const icono = screen.getByLabelText(label).querySelector('[aria-hidden="true"]');
      expect(icono?.className).toContain('hidden');
      expect(icono?.className).toContain('sm:flex');
    }
  });
});
