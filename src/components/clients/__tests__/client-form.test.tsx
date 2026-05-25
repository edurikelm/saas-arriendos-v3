import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientForm } from "../client-form";

describe("ClientForm serverError", () => {
  it("renderiza serverError debajo del campo email", () => {
    render(
      <ClientForm
        serverError="Ya existe un cliente con ese email"
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Ya existe un cliente con ese email")).toBeDefined();
  });

  it("serverError desaparece cuando se modifica el email", () => {
    render(
      <ClientForm
        serverError="Ya existe un cliente con ese email"
        onSubmit={vi.fn()}
      />
    );

    const emailInput = screen.getByLabelText("Correo electrónico *");
    fireEvent.change(emailInput, { target: { value: "nuevo@email.com" } });

    expect(screen.queryByText("Ya existe un cliente con ese email")).toBeNull();
  });

  it("no muestra serverError cuando no se pasa la prop", () => {
    render(<ClientForm onSubmit={vi.fn()} />);

    const errorTexts = screen.queryAllByText(/existe un cliente/i);
    expect(errorTexts).toHaveLength(0);
  });
});
