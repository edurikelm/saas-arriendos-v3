import { describe, it, expect } from "vitest";
import { channelColors } from "../channel-colors";

describe("channelColors", () => {
  it("AIRBNB maps to bg-info", () => {
    expect(channelColors.AIRBNB.dotClass).toBe("bg-info");
    expect(channelColors.AIRBNB.labelClass).toBe("text-info");
  });

  it("BOOKING_COM maps to bg-primary", () => {
    expect(channelColors.BOOKING_COM.dotClass).toBe("bg-primary");
    expect(channelColors.BOOKING_COM.labelClass).toBe("text-primary");
  });

  it("VRBO maps to bg-accent", () => {
    expect(channelColors.VRBO.dotClass).toBe("bg-accent");
    expect(channelColors.VRBO.labelClass).toBe("text-accent");
  });

  it("OTHER maps to bg-muted-foreground", () => {
    expect(channelColors.OTHER.dotClass).toBe("bg-muted-foreground");
    expect(channelColors.OTHER.labelClass).toBe("text-muted-foreground");
  });

  it("all channels have both dotClass and labelClass", () => {
    const channels = ["AIRBNB", "BOOKING_COM", "VRBO", "OTHER"] as const;
    for (const channel of channels) {
      expect(channelColors[channel]).toHaveProperty("dotClass");
      expect(channelColors[channel]).toHaveProperty("labelClass");
      expect(typeof channelColors[channel].dotClass).toBe("string");
      expect(typeof channelColors[channel].labelClass).toBe("string");
    }
  });

  it("dotClass values are valid Tailwind semantic token classes", () => {
    const validTokens = ["bg-info", "bg-primary", "bg-accent", "bg-muted-foreground"];
    const channels = ["AIRBNB", "BOOKING_COM", "VRBO", "OTHER"] as const;
    for (const channel of channels) {
      expect(validTokens).toContain(channelColors[channel].dotClass);
    }
  });
});
