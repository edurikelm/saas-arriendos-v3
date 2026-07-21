import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingPage } from "../pricing-page";
import type { SessionUser } from "@/lib/auth/session";
import type { SubscriptionStatus } from "@prisma/client";

const mockOwnerSession: SessionUser = {
  userId: "user-1",
  role: "OWNER",
  plan: "FREE",
  email: "owner@test.cl",
  status: "ACTIVE",
};

const mockSuperAdminSession: SessionUser = {
  userId: "admin-1",
  role: "SUPER_ADMIN",
  plan: null,
  email: "admin@test.cl",
  status: "ACTIVE",
};

describe("PricingPage", () => {
  describe("CTAs para visitante anónimo (sin sesión)", () => {
    it("muestra CTAs con el texto correcto en las cards de precio", () => {
      render(<PricingPage session={null} subscriptionStatus={null} />);

      // La card FREE tiene "Empieza gratis" (dentro de la card)
      // Verificar que existe al menos un link con ese texto
      const freeLinks = screen.getAllByText(/^Empieza gratis$/);
      expect(freeLinks.length).toBeGreaterThanOrEqual(1);

      // La card PRO tiene "Crear cuenta gratis" (dentro de la card)
      // Verificar que existe al menos un link con ese texto
      const proLinks = screen.getAllByText(/^Crear cuenta gratis$/);
      expect(proLinks.length).toBeGreaterThanOrEqual(1);
    });

    it("el CTA de la card FREE apunta a /register", () => {
      render(<PricingPage session={null} subscriptionStatus={null} />);

      // Buscar el link de la card FREE (tiene href="/register")
      const links = screen.getAllByText(/^Empieza gratis$/);
      const freeCardLink = links.find(
        (l) => (l as HTMLAnchorElement).href.includes("/register")
      );
      expect(freeCardLink).toBeTruthy();
    });

    it("el CTA de la card PRO apunta a /register?plan=pro", () => {
      render(<PricingPage session={null} subscriptionStatus={null} />);

      // Buscar el link de la card PRO (tiene href="/register?plan=pro")
      const links = screen.getAllByText(/^Crear cuenta gratis$/);
      const proCardLink = links.find(
        (l) => (l as HTMLAnchorElement).href.includes("/register?plan=pro")
      );
      expect(proCardLink).toBeTruthy();
    });
  });

  describe("CTAs para owner autenticado FREE", () => {
    it("FREE muestra badge 'Tu plan actual' (current)", () => {
      render(<PricingPage session={mockOwnerSession} subscriptionStatus={null} />);

      expect(screen.getByText("Tu plan actual")).toBeTruthy();
    });

    it("PRO muestra 'Activar PRO' con link a /settings/billing", () => {
      render(<PricingPage session={mockOwnerSession} subscriptionStatus={null} />);

      const proLink = screen.getByText("Activar PRO").closest("a");
      expect(proLink).toBeTruthy();
      expect((proLink as HTMLAnchorElement).href).toContain(
        "/settings/billing"
      );
    });
  });

  describe("CTAs para owner PRO (AUTHORIZED)", () => {
    it("PRO muestra badge 'Tu plan actual' (current)", () => {
      render(
        <PricingPage
          session={mockOwnerSession}
          subscriptionStatus={"AUTHORIZED" as SubscriptionStatus}
        />
      );

      expect(screen.getByText("Tu plan actual")).toBeTruthy();
    });

    it("FREE aparece deshabilitado", () => {
      render(
        <PricingPage
          session={mockOwnerSession}
          subscriptionStatus={"AUTHORIZED" as SubscriptionStatus}
        />
      );

      // El botón deshabilitado usa <button disabled>
      const freeBtn = screen.getByRole("button", {
        name: /plan free/i,
      });
      expect(freeBtn).toBeTruthy();
      expect((freeBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("CTAs para owner CANCELLED", () => {
    it("PRO muestra 'Reactivar PRO' con link a /settings/billing", () => {
      render(
        <PricingPage
          session={mockOwnerSession}
          subscriptionStatus={"CANCELLED" as SubscriptionStatus}
        />
      );

      const reactivateLink = screen.getByText("Reactivar PRO").closest("a");
      expect(reactivateLink).toBeTruthy();
      expect((reactivateLink as HTMLAnchorElement).href).toContain(
        "/settings/billing"
      );
    });

    it("FREE aparece deshabilitado", () => {
      render(
        <PricingPage
          session={mockOwnerSession}
          subscriptionStatus={"CANCELLED" as SubscriptionStatus}
        />
      );

      const freeBtn = screen.getByRole("button", {
        name: /plan free/i,
      });
      expect(freeBtn).toBeTruthy();
      expect((freeBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("CTAs para SUPER_ADMIN", () => {
    it("ambos planes aparecen deshabilitados", () => {
      render(
        <PricingPage
          session={mockSuperAdminSession}
          subscriptionStatus={null}
        />
      );

      const freeDisabled = screen.getByRole("button", { name: /plan free/i });
      const proDisabled = screen.getByRole("button", { name: /plan pro/i });

      expect(freeDisabled).toBeTruthy();
      expect((freeDisabled as HTMLButtonElement).disabled).toBe(true);
      expect(proDisabled).toBeTruthy();
      expect((proDisabled as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("Precio PRO", () => {
    it("muestra el precio formateado como '$9.990'", () => {
      render(<PricingPage session={null} subscriptionStatus={null} />);

      // El precio PRO se muestra con Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" })
      // que produce "$9.990" (sin decimales para números redondos)
      expect(screen.getByText("$9.990")).toBeTruthy();
    });

    it("el precio PRO incluye el sufijo '/ mes'", () => {
      render(<PricingPage session={null} subscriptionStatus={null} />);

      expect(screen.getByText("/ mes")).toBeTruthy();
    });
  });

  describe("FAQ actualizada", () => {
    it("incluye la pregunta sobre cancelación", () => {
      render(<PricingPage session={null} subscriptionStatus={null} />);

      expect(
        screen.getByText(/¿Puedo cancelar en cualquier momento?/i)
      ).toBeTruthy();
    });

    it("incluye la pregunta sobre cómo se activa PRO", () => {
      render(<PricingPage session={null} subscriptionStatus={null} />);

      expect(
        screen.getByText(/¿Cómo se activa el plan PRO?/i)
      ).toBeTruthy();
    });

    it("incluye la pregunta sobre métodos de pago", () => {
      render(<PricingPage session={null} subscriptionStatus={null} />);

      expect(
        screen.getByText(/¿Qué métodos de pago aceptan para PRO?/i)
      ).toBeTruthy();
    });
  });
});
