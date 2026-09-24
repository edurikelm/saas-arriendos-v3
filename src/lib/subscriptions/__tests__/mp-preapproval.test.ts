/**
 * Tests para `ensurePreapprovalCancelled` — helper compartido por
 * `cancelMySubscription`, `adminCancelSubscription` y
 * `ensurePreviousPreapprovalStopped` (startProUpgrade).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPreapproval: vi.fn(),
  cancelPreapproval: vi.fn(),
}));

vi.mock("@/lib/payment/pro-gateway", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payment/pro-gateway")>(
    "@/lib/payment/pro-gateway",
  );
  return {
    ...actual,
    getProGateway: vi.fn(() => ({
      fetchPreapproval: mocks.fetchPreapproval,
      cancelPreapproval: mocks.cancelPreapproval,
    })),
  };
});

import { MpApiError } from "@/lib/payment/pro-gateway";
import { ensurePreapprovalCancelled } from "../mp-preapproval";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensurePreapprovalCancelled", () => {
  it("preapproval vivo (authorized) → cancela y retorna cancelled con el status previo", async () => {
    mocks.fetchPreapproval.mockResolvedValue({ id: "pre-1", status: "authorized" });
    mocks.cancelPreapproval.mockResolvedValue(undefined);

    const result = await ensurePreapprovalCancelled("pre-1");

    expect(mocks.fetchPreapproval).toHaveBeenCalledWith("pre-1");
    expect(mocks.cancelPreapproval).toHaveBeenCalledWith("pre-1");
    expect(result).toEqual({ outcome: "cancelled", previousStatus: "authorized" });
  });

  it("preapproval vivo (paused) → cancela y retorna cancelled con el status previo", async () => {
    mocks.fetchPreapproval.mockResolvedValue({ id: "pre-1", status: "paused" });
    mocks.cancelPreapproval.mockResolvedValue(undefined);

    const result = await ensurePreapprovalCancelled("pre-1");

    expect(mocks.cancelPreapproval).toHaveBeenCalledWith("pre-1");
    expect(result).toEqual({ outcome: "cancelled", previousStatus: "paused" });
  });

  it("preapproval pending → cancela y retorna cancelled con el status previo", async () => {
    mocks.fetchPreapproval.mockResolvedValue({ id: "pre-1", status: "pending" });
    mocks.cancelPreapproval.mockResolvedValue(undefined);

    const result = await ensurePreapprovalCancelled("pre-1");

    expect(mocks.cancelPreapproval).toHaveBeenCalledWith("pre-1");
    expect(result).toEqual({ outcome: "cancelled", previousStatus: "pending" });
  });

  it("ya cancelado en MP → no llama cancelPreapproval, retorna already_cancelled", async () => {
    mocks.fetchPreapproval.mockResolvedValue({ id: "pre-1", status: "cancelled" });

    const result = await ensurePreapprovalCancelled("pre-1");

    expect(mocks.cancelPreapproval).not.toHaveBeenCalled();
    expect(result).toEqual({ outcome: "already_cancelled", previousStatus: "cancelled" });
  });

  it("fetchPreapproval responde 404 → retorna not_found sin previousStatus, no llama a cancelar", async () => {
    mocks.fetchPreapproval.mockRejectedValue(
      new MpApiError("Mercado Pago fetch preapproval error: Not Found", 404),
    );

    const result = await ensurePreapprovalCancelled("pre-missing");

    expect(mocks.cancelPreapproval).not.toHaveBeenCalled();
    expect(result).toEqual({ outcome: "not_found" });
  });

  it("fetchPreapproval responde 403 → relanza el error, no llama a cancelar", async () => {
    const error = new MpApiError("Mercado Pago fetch preapproval error: Forbidden", 403);
    mocks.fetchPreapproval.mockRejectedValue(error);

    await expect(ensurePreapprovalCancelled("pre-1")).rejects.toThrow(error);
    expect(mocks.cancelPreapproval).not.toHaveBeenCalled();
  });

  it("fetchPreapproval responde 500 → relanza el error", async () => {
    const error = new MpApiError("Mercado Pago fetch preapproval error: Internal Server Error", 500);
    mocks.fetchPreapproval.mockRejectedValue(error);

    await expect(ensurePreapprovalCancelled("pre-1")).rejects.toThrow(error);
  });

  it("fetchPreapproval lanza error de red (no MpApiError) → relanza tal cual", async () => {
    const error = new Error("fetch failed: network timeout");
    mocks.fetchPreapproval.mockRejectedValue(error);

    await expect(ensurePreapprovalCancelled("pre-1")).rejects.toThrow(error);
  });

  it("cancelPreapproval responde 404 → retorna not_found con el previousStatus de la primera consulta", async () => {
    mocks.fetchPreapproval.mockResolvedValue({ id: "pre-1", status: "authorized" });
    mocks.cancelPreapproval.mockRejectedValue(
      new MpApiError("Mercado Pago cancel preapproval error: Not Found", 404),
    );

    const result = await ensurePreapprovalCancelled("pre-1");

    expect(result).toEqual({ outcome: "not_found", previousStatus: "authorized" });
  });

  it("cancelPreapproval falla (no 404) pero el re-fetch confirma cancelled → retorna already_cancelled", async () => {
    mocks.fetchPreapproval
      .mockResolvedValueOnce({ id: "pre-1", status: "authorized" }) // primer fetch
      .mockResolvedValueOnce({ id: "pre-1", status: "cancelled" }); // re-fetch tras el fallo
    mocks.cancelPreapproval.mockRejectedValue(
      new MpApiError("Mercado Pago cancel preapproval error: timeout", 504),
    );

    const result = await ensurePreapprovalCancelled("pre-1");

    expect(mocks.fetchPreapproval).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ outcome: "already_cancelled", previousStatus: "authorized" });
  });

  it("cancelPreapproval falla y el re-fetch muestra que sigue vivo → relanza el error original", async () => {
    mocks.fetchPreapproval
      .mockResolvedValueOnce({ id: "pre-1", status: "authorized" })
      .mockResolvedValueOnce({ id: "pre-1", status: "authorized" });
    const cancelError = new MpApiError("Mercado Pago cancel preapproval error: 500", 500);
    mocks.cancelPreapproval.mockRejectedValue(cancelError);

    await expect(ensurePreapprovalCancelled("pre-1")).rejects.toThrow(cancelError);
  });

  it("cancelPreapproval falla y el re-fetch también falla → relanza el error original de cancelPreapproval", async () => {
    mocks.fetchPreapproval
      .mockResolvedValueOnce({ id: "pre-1", status: "authorized" })
      .mockRejectedValueOnce(new Error("re-fetch network error"));
    const cancelError = new MpApiError("Mercado Pago cancel preapproval error: 500", 500);
    mocks.cancelPreapproval.mockRejectedValue(cancelError);

    await expect(ensurePreapprovalCancelled("pre-1")).rejects.toThrow(cancelError);
  });
});
