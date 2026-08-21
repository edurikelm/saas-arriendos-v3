/**
 * Returns the appropriate Tailwind text color class for reservation bar text,
 * based on actual WCAG contrast ratios against both text-foreground and text-white.
 *
 * Algorithm:
 * 1. Compute relative luminance of the bar background color.
 * 2. Compute contrast ratio against text-foreground (#131f1a) and text-white.
 * 3. Pick the option with the higher contrast if both pass WCAG AA (>=4.5:1).
 * 4. If only one passes, use it. If neither passes, fall back to text-foreground.
 *
 * Contrast ratio formula (WCAG 2.1):
 *   CR = (L1 + 0.05) / (L2 + 0.05)
 * where L1 is the lighter luminance and L2 is the darker.
 */
export function getBarTextColor(
  propertyColor: string | undefined
): "text-foreground" | "text-white" {
  if (!propertyColor) return "text-foreground";

  const hex = propertyColor.replace("#", "");
  if (hex.length !== 6) return "text-foreground";

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const bgLuminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // text-foreground is #131f1a
  const fgLuminance =
    0.2126 * toLinear(0x13 / 255) +
    0.7152 * toLinear(0x1f / 255) +
    0.0722 * toLinear(0x1a / 255);

  const whiteLuminance = 1;

  const contrastRatio = (l1: number, l2: number) => {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  };

  const fgContrast = contrastRatio(bgLuminance, fgLuminance);
  const whiteContrast = contrastRatio(bgLuminance, whiteLuminance);

  const AA = 4.5;

  // Both pass -> pick the one with higher contrast
  if (fgContrast >= AA && whiteContrast >= AA) {
    return fgContrast > whiteContrast ? "text-foreground" : "text-white";
  }
  // Only one passes -> use it
  if (fgContrast >= AA) return "text-foreground";
  if (whiteContrast >= AA) return "text-white";
  // Neither passes -- fallback to text-foreground (dark text on light bg is usually more readable)
  return "text-foreground";
}
