import { RenderMath } from "../../../engine/rendering/render_math.js";

// Color of a 0..100 value on a configured low/mid/high gradient (HUD bars, cast power aim).
export function threeBandGradientColor(value, gradient) {
  if (!gradient) return "#00ccff";
  const low = gradient.breakpoints?.low ?? 33;
  const mid = gradient.breakpoints?.mid ?? 66;
  if (value < low) {
    return RenderMath.interpolateRgb(
      gradient.low?.start || [0, 0, 255],
      gradient.low?.end || [255, 255, 0],
      value / low,
    );
  }
  if (value < mid) {
    return RenderMath.interpolateRgb(
      gradient.mid?.start || [255, 255, 0],
      gradient.mid?.end || [255, 128, 0],
      (value - low) / Math.max(1, mid - low),
    );
  }
  return RenderMath.interpolateRgb(
    gradient.high?.start || [255, 128, 0],
    gradient.high?.end || [255, 0, 0],
    (value - mid) / Math.max(1, 100 - mid),
  );
}
