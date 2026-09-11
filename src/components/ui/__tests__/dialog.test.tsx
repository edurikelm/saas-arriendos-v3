import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../dialog";

function renderDialog(props: { showCloseButton?: boolean } = {}) {
  render(
    <Dialog open onOpenChange={vi.fn()}>
      <DialogContent showCloseButton={props.showCloseButton}>
        <DialogHeader>
          <DialogTitle>Eliminar pago</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  );
}

describe("Dialog", () => {
  it("el botón de cerrar tiene su nombre accesible en español", () => {
    // No se ve —es `sr-only`—, pero un usuario de lector de pantalla lo escucha
    // en CADA diálogo del producto. Era el único texto del kit sin traducir.
    renderDialog();

    expect(screen.getByRole("button", { name: "Cerrar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("se puede ocultar el botón de cerrar", () => {
    renderDialog({ showCloseButton: false });

    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
  });

  it("expone el título del diálogo", () => {
    renderDialog();

    expect(screen.getByText("Eliminar pago")).toBeTruthy();
  });
});
