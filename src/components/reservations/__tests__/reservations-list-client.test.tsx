import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReservationsListClient } from "../reservations-list-client";

// Shared references — configured inside vi.mock so they can be re-mocked in each test
const replaceMock = vi.fn();
const mockUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: replaceMock,
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock("@/lib/actions/reservations", () => ({
  createReservation: vi.fn(),
  updateReservation: vi.fn(),
  cancelReservation: vi.fn(),
  deleteReservation: vi.fn(),
  getBlockedDates: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/actions/clients", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/hooks/use-pagination", () => ({
  usePagination: vi.fn(() => ({
    page: 1,
    limit: 10,
    goToPage: vi.fn(),
    setLimit: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: vi.fn(() => false),
}));

vi.mock("@/hooks/use-reservation-filters", () => ({
  useReservationFilters: vi.fn(() => ({
    serverFilters: { propertyId: "", billingType: "", status: "" },
    paymentFilter: "",
    searchQuery: "",
    debouncedSearch: "",
    filteredReservations: [],
    hasActiveFilters: false,
    updateServerFilter: vi.fn(),
    updatePaymentFilter: vi.fn(),
    handleSearchChange: vi.fn(),
    clearAllFilters: vi.fn(),
  })),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: vi.fn(({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null
  ),
  DialogContent: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  )),
  DialogDescription: vi.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
  DialogHeader: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  DialogTitle: vi.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

vi.mock("@/components/reservations/reservation-form", () => ({
  ReservationForm: vi.fn(() => <div data-testid="reservation-form">ReservationForm</div>),
}));

vi.mock("@/components/reservations/reservation-table", () => ({
  ReservationTable: vi.fn(() => <div data-testid="reservation-table">ReservationTable</div>),
}));

vi.mock("@/components/reservations/reservation-list-item", () => ({
  ReservationListItem: vi.fn(() => <div data-testid="reservation-list-item">ReservationListItem</div>),
}));

vi.mock("@/components/ui/pagination", () => ({
  Pagination: vi.fn(() => <div data-testid="pagination">Pagination</div>),
}));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: vi.fn(() => <div data-testid="confirm-dialog">ConfirmDialog</div>),
}));

vi.mock("@/components/ui/date-range-picker", () => ({
  DateRangePicker: vi.fn(() => <div data-testid="date-range-picker">DateRangePicker</div>),
}));

vi.mock("@/components/ui/select", () => ({
  Select: vi.fn(() => <div data-testid="select">Select</div>),
  SelectContent: vi.fn(() => <div data-testid="select-content">SelectContent</div>),
  SelectItem: vi.fn(() => <div data-testid="select-item">SelectItem</div>),
  SelectTrigger: vi.fn(() => <div data-testid="select-trigger">SelectTrigger</div>),
  SelectValue: vi.fn(() => <div data-testid="select-value">SelectValue</div>),
}));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    Calendar: vi.fn(() => "Calendar"),
    Plus: vi.fn(() => "Plus"),
    X: vi.fn(() => "X"),
    Search: vi.fn(() => "Search"),
    ChevronDown: vi.fn(() => "ChevronDown"),
  };
});

const mockInitialData = {
  data: [],
  total: 0,
  totalPages: 0,
  page: 1,
  limit: 10,
};

const mockProperties = [
  {
    id: "p1",
    name: "Depto",
    unitsAvailable: 1,
    dailyPrice: "50000",
    monthlyPrice: null,
    color: "#000",
  },
];

const mockClients = [
  { id: "c1", name: "Juan", email: "j@x.com" },
];

describe("ReservationsListClient - deep-link ?create=true", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replaceMock.mockClear();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("abre el modal de creación cuando ?create=true está en la URL y limpia la URL", () => {
    // Arrange: inject ?create=true
    mockUseSearchParams.mockReturnValue(new URLSearchParams("create=true"));

    // Act
    render(
      <ReservationsListClient
        initialData={mockInitialData}
        properties={mockProperties}
        clients={mockClients}
        plan="PRO"
      />
    );

    // Assert: modal está abierto
    expect(screen.getByTestId("dialog")).toBeTruthy();
    expect(screen.getByTestId("dialog-content")).toBeTruthy();

    // Assert: título "Nueva Reserva" visible
    expect(screen.getByText("Nueva Reserva")).toBeTruthy();

    // Assert: URL fue limpiada (router.replace llamado sin create=true)
    expect(replaceMock).toHaveBeenCalledWith("/reservations", { scroll: false });
  });

  it("no abre el modal cuando no hay ?create=true en la URL", () => {
    // mockUseSearchParams already returns empty URLSearchParams from beforeEach

    render(
      <ReservationsListClient
        initialData={mockInitialData}
        properties={mockProperties}
        clients={mockClients}
        plan="PRO"
      />
    );

    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("al abrir el modal con el botón local la URL no se modifica", () => {
    // Precondición: URL sin ?create=true (viene del beforeEach).
    render(
      <ReservationsListClient
        initialData={mockInitialData}
        properties={mockProperties}
        clients={mockClients}
        plan="PRO"
      />
    );

    // Act: click en el botón "Nueva Reserva" local de la lista.
    const newReservationButton = screen.getByRole("button", { name: /nueva reserva/i });
    fireEvent.click(newReservationButton);

    // Assert: modal abierto (comportamiento principal del botón).
    expect(screen.getByTestId("dialog")).toBeTruthy();

    // Assert: la URL no se tocó (sin router.replace). Esto confirma que el
    // botón local NO dispara el deep-link effect ni ensucia el history.
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
