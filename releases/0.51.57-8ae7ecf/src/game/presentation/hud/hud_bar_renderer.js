import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";

export class HudBarRenderer {
  #surface;

  constructor(surface) {
    if (!surface || typeof surface.fillRect !== "function") {
      throw new TypeError("HudBarRenderer requires a drawing surface");
    }
    this.#surface = surface;
  }

  drawFramedRatioBar({
    x,
    y,
    width,
    height,
    ratio,
    style = {},
    fillColor = null,
    topLabel = null,
    rightValue = null,
    marker = null,
  }) {
    const ctx = this.#surface;
    const clampedRatio = clampUnit(ratio);
    const padding = finiteOr(style.padding, 2);
    const borderWidth = finiteOr(style.borderWidth, 1);
    const fillWidth = width * clampedRatio;
    const resolvedFillColor = fillColor || style.fillColor || "#00ccff";

    ctx.save();
    ctx.fillStyle = style.backgroundColor || "#1a2b3c";
    ctx.fillRect(x - padding, y - padding, width + padding * 2, height + padding * 2);

    ctx.strokeStyle = style.borderColor || "#4a5b6c";
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(x - padding, y - padding, width + padding * 2, height + padding * 2);

    ctx.fillStyle = resolvedFillColor;
    ctx.fillRect(x, y, fillWidth, height);

    const glowIntensity = finiteOr(style.glowIntensity, 0);
    if (glowIntensity > 0 && fillWidth > 0) {
      ctx.shadowColor = style.glowColor || resolvedFillColor;
      ctx.shadowBlur = finiteOr(style.glowBlur, 10) * glowIntensity;
      ctx.strokeStyle = style.glowStrokeColor || resolvedFillColor;
      ctx.lineWidth = finiteOr(style.glowLineWidth, 2);
      ctx.strokeRect(x, y, fillWidth, height);
      ctx.shadowBlur = 0;
    }

    if (marker?.enabled) {
      const markerRatio = clampUnit(marker.ratio);
      const markerX = x + width * markerRatio;
      ctx.strokeStyle = marker.color || style.markerColor || "#73c2fb";
      ctx.lineWidth = finiteOr(marker.width, 2);
      ctx.beginPath();
      ctx.moveTo(markerX, y - finiteOr(marker.extendPx, 4));
      ctx.lineTo(markerX, y + height + finiteOr(marker.extendPx, 4));
      ctx.stroke();
    }

    this.#drawLabels(
      x,
      y,
      width,
      height,
      style,
      topLabel,
      rightValue,
    );
    ctx.restore();
  }

  drawThinProgressBar({
    x,
    y,
    width,
    height,
    ratio,
    style = {},
    label = null,
    value = null,
  }) {
    const ctx = this.#surface;
    const clampedRatio = clampUnit(ratio);

    ctx.save();
    if (style.backgroundColor) {
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(x, y, width, height);
    }

    ctx.fillStyle = style.fillColor || "rgba(255, 0, 0, 0.3)";
    ctx.fillRect(x, y, width * clampedRatio, height);

    ctx.strokeStyle = style.strokeColor || style.borderColor || "#ff0000";
    ctx.lineWidth = finiteOr(style.borderWidth, 1);
    ctx.strokeRect(x, y, width, height);

    if (label) {
      ctx.fillStyle = style.labelColor || "#ff0000";
      ctx.font = style.labelFont || "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, x + width / 2, y - finiteOr(style.labelGap, 4));
    }
    if (value) {
      ctx.fillStyle = style.valueColor || style.labelColor || "#ff0000";
      ctx.font = style.valueFont || style.labelFont || "bold 10px monospace";
      ctx.textAlign = this.#resolveValueAlign(style);
      ctx.textBaseline = "middle";
      ctx.fillText(
        value,
        this.#resolveValueX(x, width, style),
        y + height / 2,
      );
    }
    ctx.restore();
  }

  #drawLabels(
    x,
    y,
    width,
    height,
    style,
    topLabel,
    rightValue,
  ) {
    if (!topLabel && !rightValue) return;

    const ctx = this.#surface;
    ctx.fillStyle = style.labelColor || "#8a9bac";
    ctx.font = style.labelFont || "bold 12px monospace";

    if (topLabel) {
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(topLabel, x + width / 2, y - finiteOr(style.labelGap, 4));
    }
    if (rightValue) {
      ctx.fillStyle = style.valueColor || style.labelColor || "#8a9bac";
      ctx.font = style.valueFont || style.labelFont || "bold 12px monospace";
      ctx.textAlign = this.#resolveValueAlign(style);
      ctx.textBaseline = "middle";
      ctx.fillText(
        rightValue,
        this.#resolveValueX(x, width, style),
        y + height / 2,
      );
      ctx.fillStyle = style.labelColor || "#8a9bac";
      ctx.font = style.labelFont || "bold 12px monospace";
    }
  }

  #resolveValueX(x, width, style) {
    return style.valuePlacement === "center"
      ? x + width / 2
      : x + width - finiteOr(style.valueGap, 6);
  }

  #resolveValueAlign(style) {
    return style.valuePlacement === "center" ? "center" : "right";
  }
}
