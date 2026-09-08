import { describe, it, expect, vi, beforeEach } from "vitest";

const getReservations = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/reservations", () => ({ getReservations }));

import { GET } from "../route";

/**
 * Cada filtro del cliente tiene que llegar hasta el server action.
 *
 * Existe por un bug real: `payment` se agregó al hook, al tipo y a la UI, pero
 * ni el cliente lo ponía en la query ni la ruta lo leía — así que el filtro no
 * hacía nada y ningún test unitario lo notaba, porque cada capa por separado
 * estaba bien. Lo agarró recién la prueba en el navegador.
 */
describe("GET /api/reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReservations.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
  });

  it("pasa todos los filtros al server action", async () => {
    await GET(
      new Request(
        "http://localhost/api/reservations?page=2&limit=20&search=ana&propertyId=p1" +
          "&status=PENDING&billingType=MONTHLY&temporal=past&payment=overdue",
      ),
    );

    expect(getReservations).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      search: "ana",
      propertyId: "p1",
      status: "PENDING",
      billingType: "MONTHLY",
      temporal: "past",
      payment: "overdue",
    });
  });

  it("lo que no viene queda undefined, no cadena vacía", async () => {
    await GET(new Request("http://localhost/api/reservations"));

    const args = getReservations.mock.calls[0][0];
    for (const key of ["search", "propertyId", "status", "billingType", "temporal", "payment"]) {
      expect(args[key]).toBeUndefined();
    }
    expect(args.page).toBe(1);
    expect(args.limit).toBe(10);
  });
});
