export class RenderMath {
  static clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  static rgba(rgb, alpha = 1) {
    const source = Array.isArray(rgb) ? rgb : [255, 255, 255];
    return `rgba(${source[0] || 0}, ${source[1] || 0}, ${source[2] || 0}, ${alpha})`;
  }

  static mixRgb(start, end, ratio) {
    const t = RenderMath.clamp(ratio);
    return [
      Math.round(start[0] + (end[0] - start[0]) * t),
      Math.round(start[1] + (end[1] - start[1]) * t),
      Math.round(start[2] + (end[2] - start[2]) * t),
    ];
  }

  static interpolateRgb(start, end, ratio) {
    const color = RenderMath.mixRgb(start, end, ratio);
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  }

  static resolveX(value, elementWidth, viewportWidth) {
    if (value === "center") {
      return (viewportWidth - elementWidth) / 2;
    }
    return Number(value) || 0;
  }

  static pointInRect(point, rect) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }
}
