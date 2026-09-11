import { describe, it, expect } from "vitest";
import { buildPaymentsOrderBy, DEFAULT_PAYMENTS_ORDER, isPaymentsSortKey } from "../sort";

describe("buildPaymentsOrderBy", () => {
  it("ordena por nombre de cliente a través de la reserva", () => {
    expect(buildPaymentsOrderBy("cliente", "asc")).toEqual({
      reservation: { client: { name: "asc" } },
    });
  });

  it("ordena por monto y por estado sobre el propio pago", () => {
    expect(buildPaymentsOrderBy("monto", "desc")).toEqual({ amount: "desc" });
    expect(buildPaymentsOrderBy("estado", "asc")).toEqual({ status: "asc" });
  });

  it("sin clave, deja el orden por defecto", () => {
    // El historial se lee del cobro más reciente al más viejo.
    expect(buildPaymentsOrderBy()).toEqual(DEFAULT_PAYMENTS_ORDER);
    expect(buildPaymentsOrderBy(undefined, "desc")).toEqual(DEFAULT_PAYMENTS_ORDER);
  });

  it("descarta una clave que no esté en la lista blanca", () => {
    // Los dos valores llegan de la URL: cualquiera puede escribir
    // `?sortBy=password`. Sin lista, eso sería un campo arbitrario.
    expect(buildPaymentsOrderBy("password", "asc")).toEqual(DEFAULT_PAYMENTS_ORDER);
    expect(buildPaymentsOrderBy("reservation.client.email", "asc")).toEqual(DEFAULT_PAYMENTS_ORDER);
  });

  it("con clave válida y dirección inválida, ordena ascendente", () => {
    // No cae al orden por defecto: la clave SÍ es válida, y lo que el usuario
    // pidió fue ordenar por esa columna.
    expect(buildPaymentsOrderBy("monto", "arriba")).toEqual({ amount: "asc" });
    expect(buildPaymentsOrderBy("monto")).toEqual({ amount: "asc" });
  });

  it("reconoce las claves de la vista, no las de la base", () => {
    expect(isPaymentsSortKey("cliente")).toBe(true);
    expect(isPaymentsSortKey("amount")).toBe(false);
    expect(isPaymentsSortKey(undefined)).toBe(false);
  });
});
