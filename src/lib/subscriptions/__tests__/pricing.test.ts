import { describe, it, expect } from "vitest";
import { PRO_PRICING, type ProPricing } from "../pricing";

describe("PRO_PRICING", () => {
  it("monthly.amount es 9990", () => {
    expect(PRO_PRICING.monthly.amount).toBe(9990);
  });

  it("monthly.currency es CLP", () => {
    expect(PRO_PRICING.monthly.currency).toBe("CLP");
  });

  it("el objeto es as const (no tiene más claves)", () => {
    const keys = Object.keys(PRO_PRICING);
    expect(keys).toEqual(["monthly"]);
  });

  it("monthly es inmutable (as const)", () => {
    // Type-level check: si no fuera `as const`, TypeScript permitiría reasignar
    // Este test es redundante en runtime pero documenta la intención.
    expect(PRO_PRICING.monthly).toEqual({
      amount: 9990,
      currency: "CLP",
      frequency: 1,
      frequencyType: "months",
    });
  });

  it("ProPricing type se infiere correctamente", () => {
    const pricing: ProPricing = {
      amount: 9990,
      currency: "CLP",
      frequency: 1,
      frequencyType: "months",
    };
    expect(pricing.amount).toBe(9990);
    expect(pricing.currency).toBe("CLP");
  });
});
