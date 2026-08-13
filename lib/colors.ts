export const DEFAULT_SERVICE_COLOR = "#CCCCCC";

/**
 * Given a hex color ("#RRGGBB"), returns black or white — whichever gives
 * better text contrast against that background — using the YIQ formula
 * (threshold 128 out of 255, the commonly-cited value for this method).
 */
export function getContrastingTextColor(hex: string): "#000000" | "#FFFFFF" {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#FFFFFF";
}
