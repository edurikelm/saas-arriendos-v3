import { describe, it, expect } from "vitest";
import { buildPaymentsWhere, overdueBoundary } from "../filters";
import { getDateKeyInTz } from "@/lib/domain/timezone";

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

describe("buildPaymentsWhere - el rango de fechas vive en la zona del negocio", () => {
  /** ¿Cae el instante dentro del rango que arma el filtro? */
  function dentroDelRango(instanteISO: string, dateFrom?: string, dateTo?: string): boolean {
    const where = buildPaymentsWhere("user-1", { dateFrom, dateTo });
    const rango = (where.createdAt ?? {}) as { gte?: Date; lte?: Date };
    const t = new Date(instanteISO).getTime();

    if (rango.gte && t < rango.gte.getTime()) return false;
    if (rango.lte && t > rango.lte.getTime()) return false;
    return true;
  }

  it("un cobro de las 21:34 de Santiago pertenece a ESE día y no al siguiente", () => {
    // Caso real de producción: $60.000 registrado el 6 de septiembre a las 21:34
    // de Santiago queda guardado como 2026-09-07T00:34Z. La tabla lo muestra el
    // 6 —formatea en la zona del navegador— y el filtro lo ponía el 7, así que
    // buscar por el día en que se registró no lo encontraba.
    const instante = "2026-09-07T00:34:29.314Z";

    expect(dentroDelRango(instante, "2026-09-06", "2026-09-06")).toBe(true);
    expect(dentroDelRango(instante, "2026-09-07", "2026-09-07")).toBe(false);
  });

  it("clasifica los otros dos casos reales igual que la tabla", () => {
    expect(dentroDelRango("2026-09-07T01:29:22.275Z", "2026-09-06", "2026-09-06")).toBe(true);
    expect(dentroDelRango("2026-09-10T00:46:51.279Z", "2026-09-09", "2026-09-09")).toBe(true);
  });

  it("el borde inferior es la medianoche de Santiago, no la de UTC", () => {
    const where = buildPaymentsWhere("user-1", { dateFrom: "2026-06-15" });
    const gte = (where.createdAt as { gte: Date }).gte;

    expect(gte.toISOString()).not.toBe("2026-06-15T00:00:00.000Z");
    expect(getDateKeyInTz(gte)).toBe("2026-06-15");
  });

  it("el borde superior cierra el último instante del día de Santiago", () => {
    const where = buildPaymentsWhere("user-1", { dateTo: "2026-06-15" });
    const lte = (where.createdAt as { lte: Date }).lte;

    expect(getDateKeyInTz(lte)).toBe("2026-06-15");
    // Un milisegundo después ya es el día siguiente: el rango cierra justo.
    expect(getDateKeyInTz(new Date(lte.getTime() + 1))).toBe("2026-06-16");
  });

  it("los dos bordes comparten referencia", () => {
    // El bug era justamente este: `gte` se interpretaba en UTC y `lte` en la
    // hora del proceso, así que un rango de un día no medía un día.
    const where = buildPaymentsWhere("user-1", { dateFrom: "2026-06-15", dateTo: "2026-06-15" });
    const { gte, lte } = where.createdAt as { gte: Date; lte: Date };

    expect(lte.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it("un rango de un día no deja fuera ni el primer ni el último instante", () => {
    const where = buildPaymentsWhere("user-1", { dateFrom: "2026-06-15", dateTo: "2026-06-15" });
    const { gte, lte } = where.createdAt as { gte: Date; lte: Date };

    expect(getDateKeyInTz(new Date(gte.getTime() - 1))).toBe("2026-06-14");
    expect(getDateKeyInTz(gte)).toBe("2026-06-15");
    expect(getDateKeyInTz(lte)).toBe("2026-06-15");
  });
});
