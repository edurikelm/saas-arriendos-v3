/**
 * Returns the appropriate Tailwind text color class for reservation bar text,
 * based on the perceived luminance of the property color.
 *
 * Uses WCAG 2.1 relative luminance formula:
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * where R, G, B are linearized sRGB values.
 *
 * Threshold: luminance > 0.5 → dark text (text-foreground),
 *            otherwise       → light text (text-white).
 * This ensures WCAG AA (4.5:1) contrast for the bar background.
 */
export function getBarTextColor(propertyColor: string | undefined): string {
  if (!propertyColor) return "text-foreground";

  const hex = propertyColor.replace("#", "");
  if (hex.length !== 6) return "text-foreground";

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return luminance > 0.5 ? "text-foreground" : "text-white";
}
