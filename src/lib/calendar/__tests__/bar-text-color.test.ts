import { describe, it, expect } from "vitest";
import { getBarTextColor } from "../bar-text-color";

describe("getBarTextColor", () => {
  // amber-500 #f59e0b — fg gives 7.9:1 (passes), white gives 2.1:1 (fails)
  it("returns text-foreground for #f59e0b (amber)", () => {
    expect(getBarTextColor("#f59e0b")).toBe("text-foreground");
  });

  // navy #1e3a8a — white gives 10.4:1 (passes), fg gives 1.6:1 (fails)
  it("returns text-white for #1e3a8a (navy)", () => {
    expect(getBarTextColor("#1e3a8a")).toBe("text-white");
  });

  // yellow #facc15 — fg gives 11:1 (passes), white gives 1.5:1 (fails)
  it("returns text-foreground for #facc15 (yellow)", () => {
    expect(getBarTextColor("#facc15")).toBe("text-foreground");
  });

  // black #000000 — white gives 21:1 (passes), fg gives 1.2:1 (fails)
  it("returns text-white for #000000 (black)", () => {
    expect(getBarTextColor("#000000")).toBe("text-white");
  });

  // white #ffffff — fg gives 17:1 (passes), white gives 1.0:1 (fails)
  it("returns text-foreground for #ffffff (white)", () => {
    expect(getBarTextColor("#ffffff")).toBe("text-foreground");
  });

  // #888888 — fg gives 4.8:1 (passes AA), white gives 3.5:1 (fails)
  // fg passes, white fails → use text-foreground
  it("returns text-foreground for #888888 (mid-grey)", () => {
    expect(getBarTextColor("#888888")).toBe("text-foreground");
  });
});
