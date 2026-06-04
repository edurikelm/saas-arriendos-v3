import { describe, expect, it } from "vitest";
import { buildCollectionReportRows, type CollectionReservationInput } from "../reports-collection";

const now = new Date("2026-01-15T12:00:00.000Z");

function makeReservation(overrides: Partial<CollectionReservationInput>): CollectionReservationInput {
  return {
    id: "res-1",
    propertyId: "prop-1",
    propertyName: "Edificio Centro",
    clientId: "cli-1",
    clientName: "Ana Perez",
    billingType: "DAILY",
    status: "CONFIRMED",
    startDate: new Date("2026-02-01T00:00:00.000Z"),
    totalPrice: 100000,
    payments: [],
    ...overrides,
  };
}

function paginate<T>(data: T[], page: number, limit: number) {
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const sliced = data.slice(skip, skip + limit);
  return { data: sliced, total, page, totalPages };
}

describe("getCollectionReport pagination", () => {
  it("PaginatedResponse envuelve correctamente", () => {
    const inputs: CollectionReservationInput[] = [];
    for (let i = 0; i < 5; i++) {
      inputs.push(makeReservation({ id: `res-${i}`, totalPrice: 100000 + i * 10000 }));
    }
    const rows = buildCollectionReportRows(inputs, { now, debtStatus: "ALL" });
    const result = paginate(rows, 1, 20);

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("totalPages");
    expect(result.data).toHaveLength(5);
    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("pagina 2 muestra los items correctos con 45 items", () => {
    const inputs: CollectionReservationInput[] = [];
    for (let i = 0; i < 45; i++) {
      inputs.push(makeReservation({ id: `res-${i}`, totalPrice: 100000 + i * 10000 }));
    }
    const rows = buildCollectionReportRows(inputs, { now, debtStatus: "ALL" });
    const result = paginate(rows, 2, 20);

    expect(result.page).toBe(2);
    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(3);
    expect(result.data).toHaveLength(20);
    expect(result.data[0].reservationId).toBe("res-20");
    expect(result.data[19].reservationId).toBe("res-39");
  });

  it("pagina 3 tiene 5 items con 45 items", () => {
    const inputs: CollectionReservationInput[] = [];
    for (let i = 0; i < 45; i++) {
      inputs.push(makeReservation({ id: `res-${i}`, totalPrice: 100000 + i * 10000 }));
    }
    const rows = buildCollectionReportRows(inputs, { now, debtStatus: "ALL" });
    const result = paginate(rows, 3, 20);

    expect(result.page).toBe(3);
    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(3);
    expect(result.data).toHaveLength(5);
    expect(result.data[0].reservationId).toBe("res-40");
    expect(result.data[4].reservationId).toBe("res-44");
  });

  it("totalPages se calcula correctamente para varios tamanos", () => {
    const cases = [
      { count: 0, expected: 0 },
      { count: 1, expected: 1 },
      { count: 19, expected: 1 },
      { count: 20, expected: 1 },
      { count: 21, expected: 2 },
      { count: 40, expected: 2 },
      { count: 41, expected: 3 },
      { count: 100, expected: 5 },
    ];

    for (const { count, expected } of cases) {
      const input: CollectionReservationInput[] = [];
      for (let i = 0; i < count; i++) {
        input.push(makeReservation({ id: `res-${i}`, startDate: new Date("2026-02-01T00:00:00.000Z") }));
      }
      const rows = buildCollectionReportRows(input, { now, debtStatus: "ALL" });
      const totalPages = Math.ceil(rows.length / 20);
      expect(totalPages).toBe(expected);
    }
  });

  it("los datos estan ordenados por nextDueDate incluso despues de paginar", () => {
    const inputs: CollectionReservationInput[] = [
      makeReservation({ id: "late", billingType: "DAILY", startDate: new Date("2026-03-01T00:00:00.000Z"), totalPrice: 50000 }),
      makeReservation({ id: "early", billingType: "DAILY", startDate: new Date("2026-01-01T00:00:00.000Z"), totalPrice: 50000 }),
      makeReservation({ id: "mid", billingType: "DAILY", startDate: new Date("2026-02-01T00:00:00.000Z"), totalPrice: 50000 }),
    ];

    const rows = buildCollectionReportRows(inputs, { now, debtStatus: "ALL" });
    const result = paginate(rows, 1, 20);

    expect(result.data[0].reservationId).toBe("early");
    expect(result.data[1].reservationId).toBe("mid");
    expect(result.data[2].reservationId).toBe("late");
  });
});
