import { describe, it, expect } from "vitest";
import { computeOverbookedDays } from "../conflicts";

describe("computeOverbookedDays", () => {
  it("bloqueo y reserva en propiedades DISTINTAS el mismo día → NO es sobreventa (bug central)", () => {
    const reservations = [
      { propertyId: "prop-a", startDate: "2026-09-26", endDate: "2026-09-26", unitsBooked: 1 },
    ];
    const blocks = [{ propertyId: "prop-b", startDate: "2026-09-26", endDate: "2026-09-26" }];
    const capacities = [
      { id: "prop-a", unitsAvailable: 1 },
      { id: "prop-b", unitsAvailable: 1 },
    ];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([]);
  });

  it("propiedad de 3 unidades con 1 reserva + 1 bloqueo → NO es sobreventa", () => {
    const reservations = [
      { propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01", unitsBooked: 1 },
    ];
    const blocks = [{ propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01" }];
    const capacities = [{ id: "prop-a", unitsAvailable: 3 }];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([]);
  });

  it("propiedad de 1 unidad con 1 reserva + 1 bloqueo → SÍ es sobreventa", () => {
    const reservations = [
      { propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01", unitsBooked: 1 },
    ];
    const blocks = [{ propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01" }];
    const capacities = [{ id: "prop-a", unitsAvailable: 1 }];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([
      { propertyId: "prop-a", date: "2026-09-01", consumed: 2, capacity: 1 },
    ]);
  });

  it("propiedad de 2 unidades con una reserva de unitsBooked: 2 + 1 bloqueo → SÍ", () => {
    const reservations = [
      { propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01", unitsBooked: 2 },
    ];
    const blocks = [{ propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01" }];
    const capacities = [{ id: "prop-a", unitsAvailable: 2 }];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([
      { propertyId: "prop-a", date: "2026-09-01", consumed: 3, capacity: 2 },
    ]);
  });

  it("reserva cancelada + bloqueo en propiedad de 1 unidad → NO (las canceladas no se pasan a esta función)", () => {
    // El caller filtra canceladas antes de llamar; acá simulamos eso: la reserva
    // cancelada simplemente no está en el array de reservas.
    const reservations: Array<{ propertyId: string; startDate: string; endDate: string; unitsBooked: number }> = [];
    const blocks = [{ propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01" }];
    const capacities = [{ id: "prop-a", unitsAvailable: 1 }];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([]);
  });

  it("dos bloqueos externos solos en propiedad de 1 unidad, sin reservas → SÍ (2 > 1)", () => {
    const reservations: Array<{ propertyId: string; startDate: string; endDate: string; unitsBooked: number }> = [];
    const blocks = [
      { propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01" },
      { propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01" },
    ];
    const capacities = [{ id: "prop-a", unitsAvailable: 1 }];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([
      { propertyId: "prop-a", date: "2026-09-01", consumed: 2, capacity: 1 },
    ]);
  });

  it("límite exacto: consumidas == capacidad → NO es sobreventa (solo >)", () => {
    const reservations = [
      { propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01", unitsBooked: 1 },
    ];
    const blocks = [{ propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01" }];
    const capacities = [{ id: "prop-a", unitsAvailable: 2 }];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([]);
  });

  it("bordes de rango inclusivo (end_date última noche): reserva de varias noches + bloqueo de 1 noche solapado al final", () => {
    // Reserva 1 unidad, 5 noches (01-05 sep), propiedad de 1 unidad.
    // Bloqueo solo el 05 sep → sobreventa solo ese día.
    const reservations = [
      { propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-05", unitsBooked: 1 },
    ];
    const blocks = [{ propertyId: "prop-a", startDate: "2026-09-05", endDate: "2026-09-05" }];
    const capacities = [{ id: "prop-a", unitsAvailable: 1 }];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([
      { propertyId: "prop-a", date: "2026-09-05", consumed: 2, capacity: 1 },
    ]);
  });

  it("reserva de 1 noche (start === end) + bloqueo la misma noche en propiedad de 1 unidad → SÍ, un solo día", () => {
    const reservations = [
      { propertyId: "prop-a", startDate: "2026-09-10", endDate: "2026-09-10", unitsBooked: 1 },
    ];
    const blocks = [{ propertyId: "prop-a", startDate: "2026-09-10", endDate: "2026-09-10" }];
    const capacities = [{ id: "prop-a", unitsAvailable: 1 }];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-09-10");
  });

  it("propiedad ausente de la lista de capacidades (dato inconsistente) → comportamiento seguro: NO alarma", () => {
    const reservations = [
      { propertyId: "prop-ghost", startDate: "2026-09-01", endDate: "2026-09-01", unitsBooked: 5 },
    ];
    const blocks = [{ propertyId: "prop-ghost", startDate: "2026-09-01", endDate: "2026-09-01" }];
    const capacities: Array<{ id: string; unitsAvailable: number }> = [];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([]);
  });

  it("acepta Date objects además de strings", () => {
    const reservations = [
      { propertyId: "prop-a", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-01"), unitsBooked: 1 },
    ];
    const blocks = [{ propertyId: "prop-a", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-01") }];
    const capacities = [{ id: "prop-a", unitsAvailable: 1 }];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([
      { propertyId: "prop-a", date: "2026-09-01", consumed: 2, capacity: 1 },
    ]);
  });

  it("acepta mix de strings y Date objects", () => {
    const reservations = [
      { propertyId: "prop-a", startDate: "2026-09-01", endDate: new Date("2026-09-01"), unitsBooked: 1 },
    ];
    const blocks = [{ propertyId: "prop-a", startDate: new Date("2026-09-01"), endDate: "2026-09-01" }];
    const capacities = [{ id: "prop-a", unitsAvailable: 1 }];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toHaveLength(1);
  });

  it("sin reservas ni bloqueos → vacío", () => {
    const result = computeOverbookedDays([], [], [{ id: "prop-a", unitsAvailable: 1 }]);
    expect(result).toEqual([]);
  });

  it("varias propiedades: solo la sobrevendida aparece en el resultado", () => {
    const reservations = [
      { propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01", unitsBooked: 1 },
      { propertyId: "prop-b", startDate: "2026-09-01", endDate: "2026-09-01", unitsBooked: 1 },
    ];
    const blocks = [{ propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-01" }];
    const capacities = [
      { id: "prop-a", unitsAvailable: 1 }, // 1 reserva + 1 bloqueo = 2 > 1 → sobreventa
      { id: "prop-b", unitsAvailable: 3 }, // 1 reserva = 1 <= 3 → ok
    ];
    const result = computeOverbookedDays(reservations, blocks, capacities);
    expect(result).toEqual([
      { propertyId: "prop-a", date: "2026-09-01", consumed: 2, capacity: 1 },
    ]);
  });

  // Regresión: el recorrido de días debe ir en UTC. Con `setDate` local, el
  // cambio de hora de Chile (DST el 6-sep-2026, UTC-4 → UTC-3) hacía que un
  // rango que cruza esa fecha emitiera el 06 DOS veces y perdiera el último
  // día. En una función que ACUMULA unidades eso produce sobreventa fantasma:
  // toda propiedad con una reserva cruzando el 6-sep se marcaba como
  // sobrevendida. Detectado en verificación visual: los 5 fixtures alarmaban
  // el día 6 sin motivo. (El bug era latente en la versión anterior, que solo
  // marcaba pertenencia booleana y no sumaba.)
  describe("cruce de cambio de hora (DST)", () => {
    it("no duplica ni pierde días en un rango que cruza el DST", () => {
      // 1 unidad, 1 reserva de 1 unidad cruzando el 6-sep: nunca hay sobreventa.
      const result = computeOverbookedDays(
        [{ propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-07", unitsBooked: 1 }],
        [],
        [{ id: "prop-a", unitsAvailable: 1 }],
      );
      expect(result).toEqual([]);
    });

    it("cuenta el último día del rango que cruza el DST", () => {
      // La reserva 01→07 debe cubrir el 07. Con el bug, el 07 no se contaba
      // y el bloqueo del 07 quedaba solo (1 <= 1 → sin alarma).
      const result = computeOverbookedDays(
        [{ propertyId: "prop-a", startDate: "2026-09-01", endDate: "2026-09-07", unitsBooked: 1 }],
        [{ propertyId: "prop-a", startDate: "2026-09-07", endDate: "2026-09-07" }],
        [{ id: "prop-a", unitsAvailable: 1 }],
      );
      expect(result).toEqual([
        { propertyId: "prop-a", date: "2026-09-07", consumed: 2, capacity: 1 },
      ]);
    });

    it("el día del DST no se cuenta dos veces", () => {
      // 2 unidades, una reserva de 1 unidad cruzando el 6-sep. Con el bug el
      // 06 sumaba 2 y empataba capacidad; con un bloqueo encima daba 3 > 2.
      // Correcto: el 06 suma 1, más el bloqueo = 2, que NO supera 2.
      const result = computeOverbookedDays(
        [{ propertyId: "prop-a", startDate: "2026-09-05", endDate: "2026-09-09", unitsBooked: 1 }],
        [{ propertyId: "prop-a", startDate: "2026-09-06", endDate: "2026-09-06" }],
        [{ id: "prop-a", unitsAvailable: 2 }],
      );
      expect(result).toEqual([]);
    });
  });
});
