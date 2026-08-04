/**
 * MercadoPagoProGateway — integración con la cuenta centralizada de Mercado Pago
 * para suscripciones PRO (no usa tokens per-owner).
 *
 * Lee MERCADOPAGO_PRO_ACCESS_TOKEN en cada llamada (sin caché; volumen bajo).
 * Si la variable no está configurada, lanza Error descriptivo.
 *
 * NO persiste el planId en env vars dinámicamente. La persistencia del mpPlanId
 * en DB es responsabilidad del lifecycle (slices siguientes).
 */

import { randomUUID } from "crypto";

import { PRO_PRICING } from "@/lib/subscriptions/pricing";
import { mpFetch } from "@/lib/payment/mp-fetch";

const BASE_URL = "https://api.mercadopago.com";

// =============================================================================
// Types
// =============================================================================

export interface MpPreapprovalInfo {
  id: string;
  status: "authorized" | "paused" | "cancelled" | "pending";
  initPoint?: string;
  nextPaymentDate?: string;
  /** Fecha de inicio del período actual (ISO 8601) */
  startDate?: string;
  /** Fecha de fin del período actual (ISO 8601) */
  endDate?: string;
  /** Email del pagador */
  payerEmail?: string;
  /** ID del preapproval_plan asociado */
  preapprovalPlanId?: string;
}

export interface ProSubscriptionGateway {
  ensurePlan(): Promise<{ planId: string }>;
  createPreapproval(args: {
    userId: string;
    payerEmail: string;
    planId: string;
  }): Promise<{ preapprovalId: string; initPoint: string }>;
  cancelPreapproval(preapprovalId: string): Promise<void>;
  fetchPreapproval(preapprovalId: string): Promise<MpPreapprovalInfo>;
}

// =============================================================================
// Implementation
// =============================================================================

export class MercadoPagoProGateway implements ProSubscriptionGateway {
  private getToken(): string {
    const token = process.env.MERCADOPAGO_PRO_ACCESS_TOKEN;
    if (!token) {
      throw new Error("MERCADOPAGO_PRO_ACCESS_TOKEN is not configured");
    }
    return token;
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.getToken()}`,
    };
  }

  async ensurePlan(): Promise<{ planId: string }> {
    const envPlanId = process.env.MERCADOPAGO_PRO_PLAN_ID;
    if (envPlanId) {
      return { planId: envPlanId };
    }

    const response = await mpFetch(`${BASE_URL}/v1/preapproval_plan`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        reason: "RentalPro PRO - Suscripcion mensual",
        back_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?subscription=created`,
        auto_recurring: {
          frequency: PRO_PRICING.monthly.frequency,
          frequency_type: PRO_PRICING.monthly.frequencyType,
          currency_id: PRO_PRICING.monthly.currency,
          transaction_amount: PRO_PRICING.monthly.amount,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Mercado Pago preapproval_plan error: ${(errorData as { message?: string }).message ?? response.statusText}`,
      );
    }

    const data = (await response.json()) as { id: string };
    return { planId: data.id };
  }

  async createPreapproval(args: {
    userId: string;
    payerEmail: string;
    planId: string;
  }): Promise<{ preapprovalId: string; initPoint: string }> {
    const response = await mpFetch(`${BASE_URL}/v1/preapproval`, {
      method: "POST",
      headers: {
        ...this.headers(),
        "X-Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        preapproval_plan_id: args.planId,
        payer_email: args.payerEmail,
        back_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?subscription=authorized`,
        external_reference: `${args.userId}:${Date.now()}`,
        status: "authorized",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Mercado Pago preapproval error: ${(errorData as { message?: string }).message ?? response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      id: string;
      init_point: string;
    };
    return { preapprovalId: data.id, initPoint: data.init_point };
  }

  async cancelPreapproval(preapprovalId: string): Promise<void> {
    const response = await mpFetch(`${BASE_URL}/v1/preapproval/${preapprovalId}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({ status: "cancelled" }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Mercado Pago cancel preapproval error: ${(errorData as { message?: string }).message ?? response.statusText}`,
      );
    }
  }

  async fetchPreapproval(preapprovalId: string): Promise<MpPreapprovalInfo> {
    const response = await mpFetch(`${BASE_URL}/v1/preapproval/${preapprovalId}`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new Error(
        `Mercado Pago fetch preapproval error: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      id: string;
      status: MpPreapprovalInfo["status"];
      init_point?: string;
      next_payment_date?: string;
      start_date?: string;
      end_date?: string;
      payer_email?: string;
      preapproval_plan_id?: string;
    };

    return {
      id: data.id,
      status: data.status,
      initPoint: data.init_point,
      nextPaymentDate: data.next_payment_date,
      startDate: data.start_date,
      endDate: data.end_date,
      payerEmail: data.payer_email,
      preapprovalPlanId: data.preapproval_plan_id,
    };
  }
}

// =============================================================================
// Factory (singleton)
// =============================================================================

let gatewayInstance: ProSubscriptionGateway | null = null;

export function getProGateway(): ProSubscriptionGateway {
  if (!gatewayInstance) {
    gatewayInstance = new MercadoPagoProGateway();
  }
  return gatewayInstance;
}

export function clearProGatewayCache(): void {
  gatewayInstance = null;
}
