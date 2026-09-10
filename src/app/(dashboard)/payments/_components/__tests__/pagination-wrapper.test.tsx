import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaginationWrapper } from "../pagination-wrapper";

const push = vi.fn();
let currentQuery = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

function renderPagination(query: string, page = 1) {
  currentQuery = query;
  return render(
    <PaginationWrapper page={page} totalPages={3} total={43} limit={20} />
  );
}

/** Devuelve los params de la última navegación, ya parseados. */
function lastPushedParams(): URLSearchParams {
  const url = push.mock.calls.at(-1)?.[0] as string;
  return new URLSearchParams(url.split("?")[1] ?? "");
}

describe("PaginationWrapper - conserva los filtros", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("mantiene todos los filtros activos al cambiar de página", async () => {
    // Antes esto navegaba a `/payments?page=N` armado desde cero, así que
    // pasar a la página 2 devolvía al listado sin filtrar.
    const user = userEvent.setup();
    renderPagination(
      "propertyId=prop-1&method=CASH&status=PENDING&paymentType=EXTRA&dateFrom=2026-01-01&dateTo=2026-01-31"
    );

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    const params = lastPushedParams();
    expect(params.get("page")).toBe("2");
    expect(params.get("propertyId")).toBe("prop-1");
    expect(params.get("method")).toBe("CASH");
    expect(params.get("status")).toBe("PENDING");
    expect(params.get("paymentType")).toBe("EXTRA");
    expect(params.get("dateFrom")).toBe("2026-01-01");
    expect(params.get("dateTo")).toBe("2026-01-31");
  });

  it("sobrescribe el page anterior en vez de acumularlo", async () => {
    const user = userEvent.setup();
    renderPagination("status=COMPLETED&page=2", 2);

    await user.click(screen.getByRole("button", { name: "3" }));

    const url = push.mock.calls.at(-1)?.[0] as string;
    expect(url.match(/page=/g)).toHaveLength(1);
    expect(lastPushedParams().get("page")).toBe("3");
    expect(lastPushedParams().get("status")).toBe("COMPLETED");
  });

  it("navega a /payments sin filtros cuando no hay ninguno activo", async () => {
    const user = userEvent.setup();
    renderPagination("");

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(push).toHaveBeenCalledWith("/payments?page=2");
  });

  it("conserva los filtros también al retroceder", async () => {
    const user = userEvent.setup();
    renderPagination("propertyId=prop-1&page=2", 2);

    await user.click(screen.getByRole("button", { name: "Anterior" }));

    const params = lastPushedParams();
    expect(params.get("page")).toBe("1");
    expect(params.get("propertyId")).toBe("prop-1");
  });
});
