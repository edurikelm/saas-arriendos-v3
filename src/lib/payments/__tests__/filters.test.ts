import { describe, it, expect } from "vitest";
import { buildPaymentsWhere, overdueBoundary } from "../filters";

describe("buildPaymentsWhere", () => {
  it("siempre ancla a las reservas del owner", () => {
    expect(buildPaymentsWhere("user-1")).toEqual({ reservation: { userId: "user-1" } });
  });

  it("el filtro de propiedad se suma al owner, no lo reemplaza", () => {
    // Dos reglas distintas escriben `where.reservation`. Si la de propiedad
    // sobrescribiera el objeto, pedir una propiedad ajena devolvería los pagos
    // de otra cuenta.
    const where = buildPaymentsWhere("user-1", { propertyId: "prop-9" });

    expect(where.reservation).toEqual({ userId: "user-1", propertyId: "prop-9" });
  });

  it("acepta los valores válidos de estado, método y tipo", () => {
    const where = buildPaymentsWhere("user-1", {
      status: "PENDING",
      method: "CASH",
      paymentType: "EXTRA",
    });

    expect(where).toMatchObject({ status: "PENDING", method: "CASH", paymentType: "EXTRA" });
  });

  it("descarta valores que no están en la lista blanca", () => {
    // Los filtros llegan de la URL: cualquiera puede escribir `?status=X`.
    const where = buildPaymentsWhere("user-1", {
      status: "CUALQUIERA",
      method: "BITCOIN",
      paymentType: "OTRO",
    });

    expect(where).not.toHaveProperty("status");
    expect(where).not.toHaveProperty("method");
    expect(where).not.toHaveProperty("paymentType");
  });

  it("combina los dos bordes del rango de fechas en una sola cláusula", () => {
    const where = buildPaymentsWhere("user-1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    expect(where.createdAt).toHaveProperty("gte");
    expect(where.createdAt).toHaveProperty("lte");
  });

  it("la búsqueda va dentro de un AND, no como OR suelto", () => {
    // El `OR` suelto es una sola clave del objeto: un segundo filtro que también
    // la quisiera pisaría a este en silencio.
    const where = buildPaymentsWhere("user-1", { search: "Pedro" });

    expect(where.OR).toBeUndefined();
    expect(where.AND).toHaveLength(1);
  });

  it("la búsqueda no desplaza el ancla de owner", () => {
    const where = buildPaymentsWhere("user-1", { search: "Pedro", propertyId: "prop-9" });

    expect(where.reservation).toEqual({ userId: "user-1", propertyId: "prop-9" });
  });

  it("agrega monto exacto solo cuando el texto trae dígitos", () => {
    const conMonto = buildPaymentsWhere("user-1", { search: "$450.000" });
    const sinMonto = buildPaymentsWhere("user-1", { search: "Pedro" });

    expect(JSON.stringify(conMonto.AND)).toContain('"amount"');
    expect(JSON.stringify(sinMonto.AND)).not.toContain('"amount"');
  });

  it("ignora una búsqueda de puros espacios", () => {
    expect(buildPaymentsWhere("user-1", { search: "   " }).AND).toBeUndefined();
  });
});

describe("overdueBoundary", () => {
  it("es la medianoche UTC del día que se le pase", () => {
    expect(overdueBoundary("2026-09-10").toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("deja vencido el día anterior y no el propio", () => {
    // Equivalente exacto a `dateOnlyKey(d) < nowKeyInBusinessTz()`, que es como
    // el dominio decide la mora. `dateOnlyKey` de un Date es su fecha UTC.
    const corte = overdueBoundary("2026-09-10");

    expect(new Date("2026-09-09T00:00:00Z") < corte).toBe(true);
    expect(new Date("2026-09-10T00:00:00Z") < corte).toBe(false);
  });

  it("clasifica bien los dueDate que NO están guardados a medianoche", () => {
    // En producción conviven las 00:00, 03:00 y 04:00 UTC del día que
    // representan. Todas tienen que caer del lado de su propio día.
    const corte = overdueBoundary("2026-09-10");

    for (const hora of ["00:00:00", "03:00:00", "04:00:00"]) {
      expect(new Date(`2026-09-09T${hora}Z`) < corte).toBe(true);
      expect(new Date(`2026-09-10T${hora}Z`) < corte).toBe(false);
    }
  });
});
