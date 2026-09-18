import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrokerForm } from "../broker-form";

describe("BrokerForm", () => {
  it("precarga el porcentaje del captador que se edita", () => {
    render(
      <BrokerForm
        initialData={{ name: "Ana Rojas", defaultCommissionRate: 8.5 }}
        onSubmit={vi.fn()}
      />,
    );

    const rate = screen.getByLabelText("Comisión por defecto (%) *") as HTMLInputElement;
    expect(rate.value).toBe("8.5");
  });

  it("manda el porcentaje como número, no como texto", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BrokerForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Nombre completo *"), {
      target: { value: "Ana Rojas" },
    });
    fireEvent.change(screen.getByLabelText("Comisión por defecto (%) *"), {
      target: { value: "12.5" },
    });
    fireEvent.submit(screen.getByText("Guardar Captador").closest("form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].defaultCommissionRate).toBe(12.5);
  });

  it("al crear, el porcentaje arranca vacío y no en 0", () => {
    // Un 0 precargado se guarda sin mirarlo, y 0% es un captador que no cobra.
    render(<BrokerForm onSubmit={vi.fn()} />);

    const rate = screen.getByLabelText("Comisión por defecto (%) *") as HTMLInputElement;
    expect(rate.value).toBe("");
  });

  it("no deja guardar sin porcentaje", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BrokerForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Nombre completo *"), {
      target: { value: "Ana Rojas" },
    });
    fireEvent.submit(screen.getByText("Guardar Captador").closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("Ingresa un porcentaje")).toBeDefined(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rechaza un porcentaje sobre 100 sin llamar al submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BrokerForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Nombre completo *"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("Comisión por defecto (%) *"), {
      target: { value: "150" },
    });
    fireEvent.submit(screen.getByText("Guardar Captador").closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("El porcentaje no puede pasar de 100")).toBeDefined(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("acepta un captador sin email: el nombre y el porcentaje bastan", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BrokerForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Nombre completo *"), {
      target: { value: "Ana Rojas" },
    });
    fireEvent.change(screen.getByLabelText("Comisión por defecto (%) *"), {
      target: { value: "10" },
    });
    fireEvent.submit(screen.getByText("Guardar Captador").closest("form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].email).toBe("");
  });

  it("avisa que las reservas viejas no se mueven cuando el captador ya tiene historia", () => {
    render(
      <BrokerForm
        initialData={{ name: "Ana", defaultCommissionRate: 10 }}
        hasReservations
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Las reservas ya registradas conservan el porcentaje/),
    ).toBeDefined();
  });

  it("sin historia, el texto de ayuda habla de precarga y no de reservas viejas", () => {
    render(<BrokerForm onSubmit={vi.fn()} />);

    expect(screen.getByText(/Se precarga al asignarlo a una reserva/)).toBeDefined();
    expect(screen.queryByText(/Las reservas ya registradas/)).toBeNull();
  });
});
