import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PaymentsKpis } from '../payments-kpis';

const defaultKpis = {
  cobrado: 2700000,
  pendiente: 250000,
  pendienteCount: 2,
  vencido: 100000,
  vencidoCount: 1,
  total: 3050000,
  totalCount: 13,
};

describe('PaymentsKpis', () => {
  it('renderiza las cuatro cifras con formato de moneda', () => {
    render(<PaymentsKpis kpis={defaultKpis} />);

    expect(screen.getByText('$2.700.000')).toBeTruthy();
    expect(screen.getByText('$250.000')).toBeTruthy();
    expect(screen.getByText('$100.000')).toBeTruthy();
    expect(screen.getByText('$3.050.000')).toBeTruthy();
  });

  it('nombra las cuatro tarjetas', () => {
    render(<PaymentsKpis kpis={defaultKpis} />);

    for (const label of ['Cobrado', 'Pendiente de cobro', 'Vencido', 'Total']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('"Cobrado" ya no dice "este mes"', () => {
    // El alcance lo fija el filtro de fechas de la vista, no una ventana
    // escondida en la cifra.
    render(<PaymentsKpis kpis={defaultKpis} />);

    expect(screen.queryByText(/este mes/i)).toBeNull();
  });

  it('declara que las cifras son del filtro cuando hay filtros', () => {
    render(<PaymentsKpis kpis={defaultKpis} filtered />);

    expect(screen.getByText('En el filtro actual')).toBeTruthy();
  });

  it('declara que son históricas cuando no hay filtros', () => {
    render(<PaymentsKpis kpis={defaultKpis} />);

    expect(screen.getByText('Histórico')).toBeTruthy();
  });

  it('pluraliza los conteos', () => {
    render(<PaymentsKpis kpis={{ ...defaultKpis, pendienteCount: 1, vencidoCount: 3 }} />);

    expect(screen.getByText('1 pago')).toBeTruthy();
    expect(screen.getByText('3 pagos')).toBeTruthy();
  });

  it('en cero, "Vencido" no se pinta de alarma', () => {
    // Pintar de rojo un cero convierte una buena noticia en alerta.
    render(<PaymentsKpis kpis={{ ...defaultKpis, vencido: 0, vencidoCount: 0 }} />);

    const valor = screen.getByLabelText('Vencido').querySelector('span');
    expect(valor?.className).toContain('text-foreground');
    expect(valor?.className).not.toContain('destructive');
  });

  it('con deuda vencida, el valor va en tono destructivo', () => {
    render(<PaymentsKpis kpis={defaultKpis} />);

    const valor = screen.getByLabelText('Vencido').querySelector('span');
    expect(valor?.className).toContain('text-destructive-text');
  });

  it('aplica tone=warning al KPI de Pendiente', () => {
    render(<PaymentsKpis kpis={defaultKpis} />);

    const valor = screen.getByLabelText('Pendiente de cobro').querySelector('span');
    expect(valor?.className).toContain('text-warning-text');
  });

  it('muestra $0 cuando no hay nada cobrado', () => {
    render(<PaymentsKpis kpis={{ ...defaultKpis, cobrado: 0 }} />);

    expect(screen.getByText('$0')).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Grilla
// ────────────────────────────────────────────────────────────────────────────

describe('PaymentsKpis - grilla', () => {
  function grid(): HTMLElement {
    return screen.getByLabelText('Cobrado').parentElement as HTMLElement;
  }

  it('usa dos columnas en móvil y cuatro en escritorio', () => {
    // `grid-cols-3` también en móvil dejaba cada card en 101px a 375px, con el
    // icono saliéndose hasta 29px. Dos columnas es lo que ya usan dashboard,
    // calendar y reports, y con cuatro cards queda un 2x2 sin huecos.
    render(<PaymentsKpis kpis={defaultKpis} />);

    // Sobre la lista de clases, no sobre el string: `lg:grid-cols-4` contiene a
    // `grid-cols-4` como subcadena y un `not.toContain` daría falso negativo.
    const clases = Array.from(grid().classList);
    expect(clases).toContain('grid-cols-2');
    expect(clases).toContain('lg:grid-cols-4');
    expect(clases).not.toContain('grid-cols-3');
  });

  it('las cuatro cards esconden el icono bajo sm', () => {
    // `density="compact"`. Con el ancho ya resuelto, el icono pasa a competir
    // con la cifra, que es el dato.
    render(<PaymentsKpis kpis={defaultKpis} />);

    for (const label of ['Cobrado', 'Pendiente de cobro', 'Vencido', 'Total']) {
      const icono = screen.getByLabelText(label).querySelector('[aria-hidden="true"]');
      expect(icono?.className).toContain('hidden');
      expect(icono?.className).toContain('sm:flex');
    }
  });
});
