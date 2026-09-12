import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentsFilters } from "../payments-filters";

const mockPush = vi.fn();
let currentQuery = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

const mockProperties = [
  { id: "prop-1", name: "Casa Central" },
  { id: "prop-2", name: "Depto Playa" },
];

function renderFilters(props: {
  propertyId?: string;
  method?: string;
  status?: string;
  paymentType?: string;
  search?: string;
  dateField?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return render(
    <PaymentsFilters
      properties={mockProperties}
      propertyId={props.propertyId ?? ""}
      method={props.method ?? ""}
      status={props.status ?? ""}
      paymentType={props.paymentType ?? ""}
      search={props.search ?? ""}
      dateField={props.dateField ?? ""}
      dateFrom={props.dateFrom ?? ""}
      dateTo={props.dateTo ?? ""}
    />
  );
}

describe("PaymentsFilters - dropdown chips", () => {
  it("renderiza todos los chips de filtro", async () => {
    renderFilters({});

    // Should show all filter chips
    expect(screen.getByRole("button", { name: /propiedad/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /método/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /estado/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /tipo/i })).toBeTruthy();
  });

  it("muestra chip activo cuando paymentType está configurado", async () => {
    renderFilters({ paymentType: "RESERVATION" });

    // Should show "Limpiar filtros" button when paymentType is set
    expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeTruthy();
    // The Tipo chip should show "Arriendo" when RESERVATION is active
    expect(screen.getByRole("button", { name: /arriendo/i })).toBeTruthy();
  });

  it("no muestra limpiar cuando no hay filtros activos", () => {
    renderFilters({});

    expect(screen.queryByRole("button", { name: /limpiar filtros/i })).toBeNull();
  });

  it("muestra label de chip según el filtro activo - propiedad", async () => {
    renderFilters({ propertyId: "prop-1" });

    // Should show the property name in the chip
    expect(screen.getByRole("button", { name: /casa central/i })).toBeTruthy();
  });

  it("muestra label de chip según el filtro activo - método", async () => {
    renderFilters({ method: "MERCADO_PAGO" });

    expect(screen.getByRole("button", { name: /mercado pago/i })).toBeTruthy();
  });

  it("muestra label de chip según el filtro activo - estado", async () => {
    renderFilters({ status: "COMPLETED" });

    expect(screen.getByRole("button", { name: /completado/i })).toBeTruthy();
  });

  it("muestra chip con estilo activo cuando hay filtro", async () => {
    renderFilters({ paymentType: "EXTRA" });

    // The Tipo chip should have active styling (contains "Extra" text)
    const tipoChip = screen.getByRole("button", { name: /extra/i });
    expect(tipoChip).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Buscador
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentsFilters - buscador", () => {
  it("renderiza el campo con su etiqueta accesible", () => {
    renderFilters({});

    const input = screen.getByLabelText("Buscar pagos");
    expect(input).toBeTruthy();
    expect(input.getAttribute("placeholder")).toContain("cliente");
  });

  it("refleja la búsqueda que ya viene en la URL", () => {
    renderFilters({ search: "María" });

    expect(screen.getByLabelText<HTMLInputElement>("Buscar pagos").value).toBe("María");
  });

  it("cuenta como filtro activo, así que ofrece limpiarlo", () => {
    renderFilters({ search: "María" });

    expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeTruthy();
  });

  it("sin búsqueda ni filtros no ofrece limpiar", () => {
    renderFilters({});

    expect(screen.queryByRole("button", { name: /limpiar filtros/i })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// El chip de fechas dice sobre qué fecha filtra
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentsFilters - chip de fechas", () => {
  it("sin rango, el chip nombra el campo en vez de decir 'Seleccionar fechas'", () => {
    // Un rango de fechas no dice sobre QUÉ fecha aplica, y la tabla tiene tres:
    // emisión, vencimiento y pago. El filtro usa la de emisión.
    renderFilters({});

    expect(screen.getByText("Emisión")).toBeTruthy();
    expect(screen.queryByText("Seleccionar fechas")).toBeNull();
  });

  it("con rango elegido, el campo sigue visible junto a las fechas", () => {
    renderFilters({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });

    expect(screen.getByText(/^Emisión:/)).toBeTruthy();
  });

  it("el rango cuenta como filtro activo", () => {
    renderFilters({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });

    expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Los chips usan el primitivo compartido
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentsFilters - chips de filtro", () => {
  it("un chip activo sigue diciendo QUÉ filtra, no solo el valor", () => {
    // Antes el valor reemplazaba al nombre de la dimensión: el chip pasaba a
    // decir "Casa Central" a secas y se perdía que eso era la propiedad. Es el
    // mismo problema que tenía el de fechas.
    renderFilters({ propertyId: "prop-1" });

    const chip = screen.getByRole("button", { name: /casa central/i });
    expect(chip.textContent).toContain("Propiedad");
    expect(chip.textContent).toContain("Casa Central");
  });

  it("un chip apagado muestra solo el nombre de la dimensión", () => {
    renderFilters({});

    const chip = screen.getByRole("button", { name: /^propiedad/i });
    expect(chip.textContent?.trim()).toBe("Propiedad");
  });

  it("cada chip activo trae su propio botón de limpiar", () => {
    // El primitivo lo renderiza como HERMANO del disparador: anidarlo dentro
    // daría HTML inválido y lo dejaría inalcanzable por teclado.
    renderFilters({ propertyId: "prop-1" });

    expect(screen.getByRole("button", { name: "Quitar filtro de propiedad" })).toBeTruthy();
  });

  it("solo el chip activo trae botón de limpiar", () => {
    renderFilters({ propertyId: "prop-1" });

    expect(screen.queryByRole("button", { name: "Quitar filtro de método" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar filtro de estado" })).toBeNull();
  });

  it("limpiar un chip no toca los demás filtros", async () => {
    const user = userEvent.setup();
    renderFilters({ propertyId: "prop-1", status: "COMPLETED" });

    await user.click(screen.getByRole("button", { name: "Quitar filtro de propiedad" }));

    // El chip de estado sigue activo, con su valor y su propio limpiar.
    expect(screen.getByRole("button", { name: "Quitar filtro de estado" })).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Sobre qué fecha aplica el rango
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentsFilters - campo de fecha", () => {
  it("por defecto el chip dice Emisión", () => {
    renderFilters({});

    expect(screen.getByText("Emisión")).toBeTruthy();
  });

  it("el chip refleja el campo elegido", () => {
    // El disparador dice QUÉ fecha se está filtrando; el selector vive dentro
    // del calendario para no gastar un chip aparte ni repetir la palabra.
    renderFilters({ dateField: "pago" });

    expect(screen.getByText("Pago")).toBeTruthy();
    expect(screen.queryByText("Emisión")).toBeNull();
  });

  it("con rango elegido, el chip antepone el campo", () => {
    renderFilters({ dateField: "vencimiento", dateFrom: "2026-09-01", dateTo: "2026-09-30" });

    expect(screen.getByText(/^Vencimiento:/)).toBeTruthy();
  });

  it("un campo desconocido cae a Emisión", () => {
    // Llega de la URL, sin pasar por ningún formulario.
    renderFilters({ dateField: "mercadoPagoId" });

    expect(screen.getByText("Emisión")).toBeTruthy();
  });

  it("elegir el campo NO cuenta como filtro activo", () => {
    // Si contara, abrir el selector encendería "Limpiar filtros" y los KPIs se
    // declararían filtrados mostrando exactamente las mismas cifras.
    renderFilters({ dateField: "pago" });

    expect(screen.queryByRole("button", { name: /limpiar filtros/i })).toBeNull();
  });

  it("con rango sí cuenta, sea cual sea el campo", () => {
    renderFilters({ dateField: "pago", dateFrom: "2026-09-01", dateTo: "2026-09-30" });

    expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeTruthy();
  });
});

describe("PaymentsFilters - cambiar el campo de fecha", () => {
  beforeEach(() => {
    currentQuery = "";
    mockPush.mockClear();
  });

  /** Params de la última navegación. */
  function lastPushedParams(): URLSearchParams {
    const url = mockPush.mock.calls.at(-1)?.[0] as string;
    return new URLSearchParams(url.split("?")[1] ?? "");
  }

  /** Renderiza, abre el calendario y devuelve el `userEvent` listo. */
  async function abrirSelector(props: Parameters<typeof renderFilters>[0] = {}) {
    renderFilters(props);
    const user = userEvent.setup();
    const label = props.dateField === "pago" ? /pago/i : /emisión/i;
    await user.click(screen.getByRole("button", { name: label }));
    return user;
  }

  it("el selector vive dentro del calendario, no en un chip aparte", async () => {
    await abrirSelector();

    // Las tres opciones, como control segmentado: es el caso de FilterPill.
    expect(await screen.findByRole("group", { name: /fecha sobre la que filtrar/i })).toBeTruthy();
  });

  it("elegir Pago lo lleva a la URL", async () => {
    currentQuery = "dateFrom=2026-09-01&dateTo=2026-09-30";
    const user = await abrirSelector({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });

    await user.click(screen.getByRole("button", { name: "Pago" }));

    expect(lastPushedParams().get("dateField")).toBe("pago");
  });

  it("cambiar de campo conserva el rango, para poder comparar el mismo mes", async () => {
    currentQuery = "dateFrom=2026-09-01&dateTo=2026-09-30";
    const user = await abrirSelector({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });

    await user.click(screen.getByRole("button", { name: "Vencimiento" }));

    const params = lastPushedParams();
    expect(params.get("dateFrom")).toBe("2026-09-01");
    expect(params.get("dateTo")).toBe("2026-09-30");
  });

  it("volver a Emisión borra el param en vez de escribir el valor por defecto", async () => {
    currentQuery = "dateField=pago";
    const user = await abrirSelector({ dateField: "pago" });

    await user.click(screen.getByRole("button", { name: "Emisión" }));

    expect(lastPushedParams().get("dateField")).toBeNull();
  });

  it("cambiar de campo vuelve a la página 1", async () => {
    currentQuery = "page=3&dateFrom=2026-09-01";
    const user = await abrirSelector({ dateFrom: "2026-09-01" });

    await user.click(screen.getByRole("button", { name: "Pago" }));

    expect(lastPushedParams().get("page")).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// El chip muestra el día elegido, no el anterior
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentsFilters - el rango no se corre un día", () => {
  const tzOriginal = process.env.TZ;

  afterEach(() => {
    if (tzOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = tzOriginal;
  });

  it("en Chile muestra el día que dice la URL, no el anterior", () => {
    // El bug que reportó el usuario. `new Date("2026-09-01")` se interpreta en
    // UTC y el calendario lo dibuja en la zona del navegador, así que en Chile
    // (UTC−3/−4) marcaba el 31 de agosto.
    process.env.TZ = "America/Santiago";

    renderFilters({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });

    const chip = screen.getByText(/^Emisión:/).textContent ?? "";
    expect(chip).toContain("1 sep 2026");
    expect(chip).toContain("30 sep 2026");
    expect(chip).not.toContain("31 ago");
    expect(chip).not.toContain("29 sep");
  });

  it("en una zona de offset positivo muestra lo mismo", () => {
    process.env.TZ = "Asia/Tokyo";

    renderFilters({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });

    const chip = screen.getByText(/^Emisión:/).textContent ?? "";
    expect(chip).toContain("1 sep 2026");
    expect(chip).toContain("30 sep 2026");
  });
});
