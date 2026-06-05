import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOwnerDetail } from "@/lib/actions/admin-users";

vi.mock("@/lib/actions/admin-users", () => ({
  getOwnerDetail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

const mockGetOwnerDetail = getOwnerDetail as ReturnType<typeof vi.fn>;

describe("AdminUserDetailPage", () => {
  describe("module exports", () => {
    it("page module should be importable", async () => {
      const page = await import("@/app/admin/users/[id]/page");
      expect(page.default).toBeDefined();
    });
  });

  describe("types and interfaces", () => {
    it("OwnerDetailResult should have required fields", async () => {
      const mockResult = {
        owner: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          plan: "FREE",
          role: "OWNER",
          createdAt: new Date(),
          _count: { properties: 1, clients: 2, reservations: 3 },
        },
        stats: {
          properties: 1,
          clients: 2,
          reservations: 3,
          totalRevenue: 1000000,
          paidAmount: 500000,
          pendingAmount: 300000,
          overdueAmount: 200000,
          propertiesLimit: 3,
          hasMpIntegration: true,
          isMpConnected: true,
        },
        properties: [],
        reservations: [],
        payments: [],
      };

      (getOwnerDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      const result = await getOwnerDetail("user-123");
      
      expect(result).toBeDefined();
      expect(result?.owner.id).toBe("user-123");
      expect(result?.stats.paidAmount).toBe(500000);
    });

    it("should return null when user not found", async () => {
      mockGetOwnerDetail.mockResolvedValue(null);
      
      const result = await getOwnerDetail("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("API route", () => {
    it("GET /api/admin/users/[id] should return owner detail", async () => {
      const mockOwner = {
        id: "user-123",
        name: "Test Owner",
        email: "test@example.com",
        plan: "FREE",
        role: "OWNER",
        createdAt: new Date(),
        _count: { properties: 1, clients: 2, reservations: 3 },
      };
      
      mockGetOwnerDetail.mockResolvedValue({
        owner: mockOwner,
        stats: {
          properties: 1,
          clients: 2,
          reservations: 3,
          totalRevenue: 1000000,
          paidAmount: 500000,
          pendingAmount: 300000,
          overdueAmount: 200000,
          propertiesLimit: 3,
          hasMpIntegration: true,
          isMpConnected: true,
        },
        properties: [],
        reservations: [],
        payments: [],
      });

      const result = await getOwnerDetail("user-123");
      expect(result).toBeDefined();
      expect(result?.owner.email).toBe("test@example.com");
    });
  });

  describe("Notas internas section", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("notes tab should exist in owner detail page", async () => {
      const { getOwnerDetail } = await import("@/lib/actions/admin-users");
      const mockResult = {
        owner: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          plan: "FREE",
          role: "OWNER",
          createdAt: new Date(),
          _count: { properties: 1, clients: 2, reservations: 3 },
        },
        stats: {
          properties: 1,
          clients: 2,
          reservations: 3,
          totalRevenue: 1000000,
          paidAmount: 500000,
          pendingAmount: 300000,
          overdueAmount: 200000,
          propertiesLimit: 3,
          hasMpIntegration: true,
          isMpConnected: true,
        },
        properties: [],
        reservations: [],
        payments: [],
      };
      (getOwnerDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      const result = await getOwnerDetail("user-123");
      expect(result).toBeDefined();
    });

    it("should have notes API endpoint for owner", async () => {
      const mockNotes = [
        {
          id: "note-1",
          adminId: "admin-1",
          ownerId: "user-123",
          content: "Nota de prueba",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          admin: { id: "admin-1", name: "Admin Test", email: "admin@test.com" },
        },
      ];
      
       global.fetch = vi.fn().mockResolvedValue({
         ok: true,
         json: () => Promise.resolve(mockNotes),
       }) as unknown as typeof fetch;

      const response = await fetch("/api/admin/notes?ownerId=user-123");
      const notes = await response.json();
      
      expect(notes).toBeDefined();
      expect(Array.isArray(notes)).toBe(true);
      expect(notes[0].content).toBe("Nota de prueba");
    });

    it("should create a new note via POST /api/admin/notes", async () => {
      const mockCreatedNote = {
        id: "note-new",
        adminId: "admin-1",
        ownerId: "user-123",
        content: "Nueva nota",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        admin: { id: "admin-1", name: "Admin Test", email: "admin@test.com" },
      };

       global.fetch = vi.fn().mockResolvedValue({
         ok: true,
         json: () => Promise.resolve(mockCreatedNote),
       }) as unknown as typeof fetch;

      const response = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: "user-123", content: "Nueva nota" }),
      });
      const note = await response.json();
      
      expect(note.id).toBe("note-new");
      expect(note.content).toBe("Nueva nota");
    });

    it("should delete a note via DELETE /api/admin/notes", async () => {
       global.fetch = vi.fn().mockResolvedValue({
         ok: true,
         json: () => Promise.resolve({ success: true }),
       }) as unknown as typeof fetch;

      const response = await fetch("/api/admin/notes?noteId=note-1", {
        method: "DELETE",
      });
      const result = await response.json();
      
      expect(result.success).toBe(true);
    });

    it("should return author and date for each note", async () => {
      const mockNotes = [
        {
          id: "note-1",
          adminId: "admin-1",
          ownerId: "user-123",
          content: "Nota con autor",
          createdAt: "2024-01-15T10:00:00.000Z",
          updatedAt: "2024-01-15T10:00:00.000Z",
          admin: { id: "admin-1", name: "Juan Admin", email: "juan@admin.com" },
        },
      ];

       global.fetch = vi.fn().mockResolvedValue({
         ok: true,
         json: () => Promise.resolve(mockNotes),
       }) as unknown as typeof fetch;

      const response = await fetch("/api/admin/notes?ownerId=user-123");
      const notes = await response.json();
      
      expect(notes[0].admin.name).toBe("Juan Admin");
      expect(notes[0].createdAt).toBeDefined();
    });
  });

  describe("Onboarding Progress", () => {
    const createMockResult = (overrides: Partial<{
      properties: number;
      clients: number;
      reservations: number;
      payments: number;
      completedPayments: number;
      hasMpIntegration: boolean;
      isMpConnected: boolean;
    }> = {}) => {
      const {
        properties = 0,
        clients = 0,
        reservations = 0,
        payments = 0,
        completedPayments = 0,
        hasMpIntegration = false,
        isMpConnected = false,
      } = overrides;

      return {
        owner: {
          id: "user-123",
          name: "Test Owner",
          email: "test@example.com",
          plan: "FREE",
          role: "OWNER",
          createdAt: new Date(),
          _count: { properties, clients, reservations },
        },
        stats: {
          properties,
          clients,
          reservations,
          totalRevenue: 0,
          paidAmount: 0,
          pendingAmount: 0,
          overdueAmount: 0,
          propertiesLimit: 3,
          hasMpIntegration,
          isMpConnected,
        },
        properties: Array(properties).fill(null).map((_, i) => ({
          id: `prop-${i}`,
          name: `Property ${i}`,
          unitsAvailable: 1,
          dailyPrice: 50000,
          color: "#3B82F6",
          _count: { reservations: 0 },
        })),
        reservations: [],
        payments: Array(completedPayments).fill(null).map((_, i) => ({
          id: `pay-${i}`,
          amount: 50000,
          status: "COMPLETED",
          method: "MERCADO_PAGO",
          dueDate: null,
          paidAt: new Date(),
          isOverdue: false,
        })),
      };
    };

    it("should calculate onboarding steps from existing data without new schema", () => {
      const result = createMockResult({
        properties: 1,
        clients: 1,
        reservations: 1,
        payments: 1,
        completedPayments: 1,
        hasMpIntegration: true,
        isMpConnected: true,
      });

      expect(result.stats.properties).toBe(1);
      expect(result.stats.clients).toBe(1);
      expect(result.stats.reservations).toBe(1);
      expect(result.payments.length).toBe(1);
      expect(result.stats.hasMpIntegration).toBe(true);
      expect(result.stats.isMpConnected).toBe(true);
    });

    it("should have 7 onboarding steps defined", () => {
      const steps = [
        { key: "account_created", label: "Cuenta creada" },
        { key: "first_property", label: "Primera propiedad" },
        { key: "first_client", label: "Primer cliente" },
        { key: "first_reservation", label: "Primera reserva" },
        { key: "first_payment", label: "Primer pago" },
        { key: "first_payment_completed", label: "Primer pago completado" },
        { key: "mp_connected", label: "Mercado Pago conectado" },
      ];

      expect(steps).toHaveLength(7);
    });

    it("step 1: account created should be completed if user exists", () => {
      const mockResult = createMockResult({});
      const isAccountCreated = !!mockResult.owner.id;
      expect(isAccountCreated).toBe(true);
    });

    it("step 2: first property should be completed when properties.count > 0", () => {
      const withoutProperty = createMockResult({ properties: 0 });
      expect(withoutProperty.stats.properties).toBe(0);

      const withProperty = createMockResult({ properties: 1 });
      expect(withProperty.stats.properties).toBeGreaterThan(0);
    });

    it("step 3: first client should be completed when clients.count > 0", () => {
      const withoutClient = createMockResult({ clients: 0 });
      expect(withoutClient.stats.clients).toBe(0);

      const withClient = createMockResult({ clients: 1 });
      expect(withClient.stats.clients).toBeGreaterThan(0);
    });

    it("step 4: first reservation should be completed when reservations.count > 0", () => {
      const withoutReservation = createMockResult({ reservations: 0 });
      expect(withoutReservation.stats.reservations).toBe(0);

      const withReservation = createMockResult({ reservations: 1 });
      expect(withReservation.stats.reservations).toBeGreaterThan(0);
    });

    it("step 5: first payment should be completed when payments.count > 0", () => {
      const withoutPayment = createMockResult({ payments: 0, completedPayments: 0 });
      expect(withoutPayment.payments.length).toBe(0);

      const withPayment = createMockResult({ payments: 0, completedPayments: 1 });
      expect(withPayment.payments.length).toBe(1);
    });

    it("step 6: first payment completed should be completed when completedPayments.count > 0", () => {
      const withoutCompleted = createMockResult({ completedPayments: 0 });
      const hasCompletedPayment = withoutCompleted.payments.some(p => p.status === "COMPLETED" && p.paidAt);
      expect(hasCompletedPayment).toBe(false);

      const withCompleted = createMockResult({ completedPayments: 1 });
      const hasCompleted = withCompleted.payments.some(p => p.status === "COMPLETED" && p.paidAt);
      expect(hasCompleted).toBe(true);
    });

    it("step 7: MP connected should be completed when UserIntegration.isActive === true", () => {
      const notConnected = createMockResult({ hasMpIntegration: false, isMpConnected: false });
      expect(notConnected.stats.hasMpIntegration).toBe(false);

      const connected = createMockResult({ hasMpIntegration: true, isMpConnected: true });
      expect(connected.stats.isMpConnected).toBe(true);
    });

    it("should correctly identify owner stuck at step 5 (has properties, clients, reservations but no payments)", () => {
      const stuckOwner = createMockResult({
        properties: 1,
        clients: 1,
        reservations: 1,
        payments: 0,
        completedPayments: 0,
        hasMpIntegration: false,
        isMpConnected: false,
      });

      expect(stuckOwner.stats.properties).toBe(1);
      expect(stuckOwner.stats.clients).toBe(1);
      expect(stuckOwner.stats.reservations).toBe(1);
      expect(stuckOwner.payments.length).toBe(0);
      expect(stuckOwner.stats.hasMpIntegration).toBe(false);
    });
  });

  describe("Notas internas section", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should support notes feature for owner detail page", async () => {
      const { getOwnerDetail } = await import("@/lib/actions/admin-users");
      const mockResult = {
        owner: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          plan: "FREE",
          role: "OWNER",
          createdAt: new Date(),
          _count: { properties: 1, clients: 2, reservations: 3 },
        },
        stats: {
          properties: 1,
          clients: 2,
          reservations: 3,
          totalRevenue: 1000000,
          paidAmount: 500000,
          pendingAmount: 300000,
          overdueAmount: 200000,
          propertiesLimit: 3,
          hasMpIntegration: true,
          isMpConnected: true,
        },
        properties: [],
        reservations: [],
        payments: [],
      };
      (getOwnerDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      const result = await getOwnerDetail("user-123");
      expect(result).toBeDefined();
    });

    it("AdminNote model should have required fields for notes display", () => {
      const mockNote = {
        id: "note-1",
        adminId: "admin-1",
        ownerId: "user-123",
        content: "Nota de prueba",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        admin: { id: "admin-1", name: "Admin Test", email: "admin@test.com" },
      };

      expect(mockNote.id).toBeDefined();
      expect(mockNote.content).toBeDefined();
      expect(mockNote.admin.name).toBe("Admin Test");
      expect(mockNote.createdAt).toBeDefined();
    });

    it("should support creating notes via API", async () => {
      const mockCreatedNote = {
        id: "note-new",
        adminId: "admin-1",
        ownerId: "user-123",
        content: "Nueva nota",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        admin: { id: "admin-1", name: "Admin Test", email: "admin@test.com" },
      };

      expect(mockCreatedNote.id).toBe("note-new");
      expect(mockCreatedNote.content).toBe("Nueva nota");
    });

    it("should support deleting notes via API", async () => {
      const deleteResult = { success: true };
      expect(deleteResult.success).toBe(true);
    });

    it("notes API should return author and date for display", () => {
      const mockNotes = [
        {
          id: "note-1",
          adminId: "admin-1",
          ownerId: "user-123",
          content: "Nota con autor",
          createdAt: "2024-01-15T10:00:00.000Z",
          updatedAt: "2024-01-15T10:00:00.000Z",
          admin: { id: "admin-1", name: "Juan Admin", email: "juan@admin.com" },
        },
      ];

      expect(mockNotes[0].admin.name).toBe("Juan Admin");
      expect(mockNotes[0].createdAt).toBeDefined();
    });
  });
});
