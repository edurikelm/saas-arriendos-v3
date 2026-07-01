import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Combobox } from '../combobox';

const defaultOptions = [
  { value: '1', label: 'Opción 1' },
  { value: '2', label: 'Opción 2' },
  { value: '3', label: 'Opción 3' },
];

describe('Combobox', () => {
  const defaultProps = {
    options: defaultOptions,
    value: '',
    onValueChange: vi.fn(),
    placeholder: 'Selecciona una opción',
  };

  it('renderiza el trigger con placeholder', () => {
    render(<Combobox {...defaultProps} />);
    expect(screen.getByText('Selecciona una opción')).toBeDefined();
  });

  it('renderiza el valor seleccionado', () => {
    render(<Combobox {...defaultProps} value="2" />);
    expect(screen.getByText('Opción 2')).toBeDefined();
  });

  it('filtra opciones al escribir por label', () => {
    render(<Combobox {...defaultProps} />);

    fireEvent.click(screen.getByText('Selecciona una opción'));

    const input = screen.getByPlaceholderText('Buscar...');
    fireEvent.change(input, { target: { value: 'Opción 1' } });

    expect(screen.getByText('Opción 1')).toBeDefined();
    expect(screen.queryByText('Opción 2')).toBeNull();
    expect(screen.queryByText('Opción 3')).toBeNull();
  });

  it('filtra opciones también por subtitle', () => {
    const optionsWithSubtitle = [
      { value: '1', label: 'Juan Pérez', subtitle: 'juan@ejemplo.com' },
      { value: '2', label: 'María García', subtitle: 'maria@otro.com' },
    ];
    render(
      <Combobox
        options={optionsWithSubtitle}
        value=""
        onValueChange={vi.fn()}
        placeholder="Selecciona"
      />
    );

    fireEvent.click(screen.getByText('Selecciona'));

    const input = screen.getByPlaceholderText('Buscar...');
    fireEvent.change(input, { target: { value: 'juan@ejemplo' } });

    expect(screen.getByText('Juan Pérez')).toBeDefined();
    expect(screen.queryByText('María García')).toBeNull();
  });

  it('selecciona opción al hacer click', () => {
    const onValueChange = vi.fn();
    render(<Combobox {...defaultProps} onValueChange={onValueChange} />);

    fireEvent.click(screen.getByText('Selecciona una opción'));

    fireEvent.click(screen.getByText('Opción 2'));

    expect(onValueChange).toHaveBeenCalledWith('2');
  });

  it('selecciona opción al presionar Enter', () => {
    const onValueChange = vi.fn();
    render(<Combobox {...defaultProps} onValueChange={onValueChange} />);

    fireEvent.click(screen.getByText('Selecciona una opción'));

    const input = screen.getByPlaceholderText('Buscar...');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onValueChange).toHaveBeenCalledWith('1');
  });

  it('muestra notFoundMessage cuando no hay resultados', () => {
    render(<Combobox {...defaultProps} notFoundMessage="Sin resultados" />);

    fireEvent.click(screen.getByText('Selecciona una opción'));

    const input = screen.getByPlaceholderText('Buscar...');
    fireEvent.change(input, { target: { value: 'xyz' } });

    expect(screen.getByText('Sin resultados')).toBeDefined();
  });

  it('muestra footerAction al final de la lista', () => {
    const footerAction = { label: 'Agregar nuevo', onClick: vi.fn() };
    render(<Combobox {...defaultProps} footerAction={footerAction} />);

    fireEvent.click(screen.getByText('Selecciona una opción'));

    expect(screen.getByText('Agregar nuevo')).toBeDefined();
  });

  it('llama a footerAction.onClick al clickear', () => {
    const onClick = vi.fn();
    const footerAction = { label: 'Agregar nuevo', onClick };
    render(<Combobox {...defaultProps} footerAction={footerAction} />);

    fireEvent.click(screen.getByText('Selecciona una opción'));

    fireEvent.click(screen.getByText('Agregar nuevo'));

    expect(onClick).toHaveBeenCalled();
  });
});
