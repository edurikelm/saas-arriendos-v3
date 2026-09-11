import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangePicker } from '../date-range-picker';

describe('DateRangePicker', () => {
  it('propaga id al Button trigger', () => {
    render(
      <DateRangePicker
        date={{ from: undefined, to: undefined }}
        onDateChange={() => {}}
        id="date-test"
      />
    );
    expect(document.getElementById('date-test')).toBeDefined();
    expect(document.getElementById('date-test')?.tagName).toBe('BUTTON');
  });
});

describe("DateRangePicker - header", () => {
  it("muestra el contenido del header al abrir el calendario", async () => {
    // El slot existe para que el consumidor ponga ahí el control de QUÉ se
    // está eligiendo, sin gastar un chip aparte.
    const user = userEvent.setup();
    render(
      <DateRangePicker
        date={{ from: undefined, to: undefined }}
        onDateChange={vi.fn()}
        label="Emisión"
        header={<span>Sobre qué fecha</span>}
      />,
    );

    await user.click(screen.getByRole("button", { name: /emisión/i }));

    expect(await screen.findByText("Sobre qué fecha")).toBeTruthy();
  });

  it("sin header, el calendario abre igual", async () => {
    const user = userEvent.setup();
    render(
      <DateRangePicker date={{ from: undefined, to: undefined }} onDateChange={vi.fn()} label="Emisión" />,
    );

    await user.click(screen.getByRole("button", { name: /emisión/i }));

    expect(screen.queryByText("Sobre qué fecha")).toBeNull();
  });
});
