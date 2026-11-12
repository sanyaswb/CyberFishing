import { clampUnitFinite, nonNegativeOr } from "../../../engine/math/number_normalization.js";

export class PlayerPressureFatigueIndicatorRenderer {
  #surface;
  #fallbackConfig;
  #colorCache = new Map();

  constructor({ surface, config = {} } = {}) {
    if (!surface || typeof surface.arc !== "function") {
      throw new TypeError(
        "PlayerPressureFatigueIndicatorRenderer requires surface",
      );
    }
    this.#surface = surface;
    this.#fallbackConfig = config || {};
  }

  render(model) {
    const state = model?.state || {};
    const config = model?.config || this.#fallbackConfig;
    if (config.enabled !== true) return;
    const stateName = state.stateName || "idle";
    if (stateName === "idle" && config.idleVisible !== true) return;

    const radius = nonNegativeOr(config.radius, 16);
    const ringWidth = nonNegativeOr(config.ringWidth, 4);
    const width = nonNegativeOr(model.viewportWidth);
    const position = config.position || {};
    const offsetX = nonNegativeOr(position.offsetX, 24);
    const offsetY = nonNegativeOr(position.offsetY, 24);
    const x = width - offsetX - radius;
    const y = offsetY + radius;
    const progress = this.#progress({ state, stateName });
    const color = this.#color({ state, stateName, config });
    const colors = config.colors || {};
    const surface = this.#surface;

    surface.save();
    surface.beginPath();
    surface.arc(x, y, radius + ringWidth, 0, Math.PI * 2);
    surface.fillStyle = colors.background || "rgba(0, 0, 0, 0.35)";
    surface.fill();

    surface.beginPath();
    surface.arc(x, y, radius, 0, Math.PI * 2);
    surface.strokeStyle =
      colors.ringBackground || "rgba(255, 255, 255, 0.18)";
    surface.lineWidth = ringWidth;
    surface.stroke();

    surface.beginPath();
    surface.arc(
      x,
      y,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * progress,
    );
    surface.strokeStyle = color;
    surface.lineWidth = ringWidth;
    surface.stroke();

    surface.beginPath();
    surface.arc(x, y, Math.max(1, radius - ringWidth - 2), 0, Math.PI * 2);
    surface.fillStyle = color;
    surface.globalAlpha = 0.28;
    surface.fill();
    surface.globalAlpha = 1;
    surface.restore();
  }

  #progress({ state, stateName }) {
    if (stateName === "grace") {
      const duration = nonNegativeOr(state.graceDurationMs);
      if (duration <= 0) return 0;
      return clampUnitFinite(nonNegativeOr(state.graceElapsedMs) / duration);
    }
    return clampUnitFinite(state.fatigueProgress);
  }

  #color({ state, stateName, config }) {
    const colors = config.colors || {};
    if (stateName === "grace") return colors.grace || "#ffffff";
    if (stateName === "recovered") return colors.ready || "#2ecc71";
    const progress = clampUnitFinite(state.fatigueProgress);
    if (progress < 0.5) {
      return this.#lerpColor(
        colors.ready || "#2ecc71",
        colors.warning || "#f1c40f",
        progress * 2,
      );
    }
    return this.#lerpColor(
      colors.warning || "#f1c40f",
      colors.danger || "#e74c3c",
      (progress - 0.5) * 2,
    );
  }

  #lerpColor(left, right, t) {
    const a = this.#parseColor(left);
    const b = this.#parseColor(right);
    const ratio = clampUnitFinite(t);
    const r = Math.round(a.r + (b.r - a.r) * ratio);
    const g = Math.round(a.g + (b.g - a.g) * ratio);
    const bl = Math.round(a.b + (b.b - a.b) * ratio);
    return `rgb(${r}, ${g}, ${bl})`;
  }

  #parseColor(value) {
    const source = String(value || "").trim();
    if (this.#colorCache.has(source)) return this.#colorCache.get(source);
    let parsed = { r: 255, g: 255, b: 255 };
    if (/^#[0-9a-f]{6}$/i.test(source)) {
      parsed = {
        r: parseInt(source.slice(1, 3), 16),
        g: parseInt(source.slice(3, 5), 16),
        b: parseInt(source.slice(5, 7), 16),
      };
    }
    this.#colorCache.set(source, parsed);
    return parsed;
  }
}
