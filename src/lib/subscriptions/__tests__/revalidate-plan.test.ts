/**
 * Fija la regla de invalidacion: el badge de plan del sidebar vive en el
 * segmento de LAYOUT, asi que revalidar solo las paginas lo deja mostrando el
 * plan anterior. El target tiene que ser ("/", "layout").
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { revalidateAfterPlanChange } from "@/lib/subscriptions/revalidate-plan";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("revalidateAfterPlanChange", () => {
  it("PRO → FREE: revalida el arbol de layouts, no una lista de rutas", () => {
    revalidateAfterPlanChange({ from: "PRO", to: "FREE", source: "subscription_lifecycle" });

    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    // El segundo argumento es lo que hace que el sidebar se vuelva a renderizar.
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("FREE → PRO: tambien revalida (el badge miente en las dos direcciones)", () => {
    revalidateAfterPlanChange({ from: "FREE", to: "PRO", source: "subscription_lifecycle" });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("sin cambio de plan (from === to): no revalida", () => {
    revalidateAfterPlanChange({ from: "PRO", to: "PRO", source: "subscription_lifecycle" });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("evento que no toca el plan (planChange undefined): no revalida", () => {
    revalidateAfterPlanChange(undefined);

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
