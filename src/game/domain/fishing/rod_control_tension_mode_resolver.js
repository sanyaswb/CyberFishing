export class RodControlTensionModeResolver {
  resolve({
    fishVelocity,
    controlAxis,
    config,
  } = {}) {
    const cfg = config || {};
    const axisX = Number(controlAxis?.x) || 0;
    const axisY = Number(controlAxis?.y) || 0;
    const axisLength = Math.hypot(axisX, axisY);
    if (axisLength <= 0.000001) {
      return this.#createResult();
    }

    const normalizedAxisX = axisX / axisLength;
    const normalizedAxisY = axisY / axisLength;
    const velocityX = Number(fishVelocity?.x) || 0;
    const velocityY = Number(fishVelocity?.y) || 0;
    const fishSpeedPxPerSec = Math.hypot(velocityX, velocityY);
    const configuredMinSpeed = Number(cfg.minFishSpeedPxPerSec);
    const minFishSpeedPxPerSec = Math.max(
      0,
      Number.isFinite(configuredMinSpeed) ? configuredMinSpeed : 1,
    );
    if (fishSpeedPxPerSec < minFishSpeedPxPerSec) {
      return this.#createResult({
        controlAxisX: normalizedAxisX,
        controlAxisY: normalizedAxisY,
        fishSpeedPxPerSec,
      });
    }

    const projectionSpeedPxPerSec =
      velocityX * normalizedAxisX +
      velocityY * normalizedAxisY;
    const alignment = this.#clamp(
      projectionSpeedPxPerSec / fishSpeedPxPerSec,
      -1,
      1,
    );
    const sameDirectionThreshold = this.#clamp(
      cfg.sameDirectionThreshold,
      -1,
      1,
      0.35,
    );
    const oppositeDirectionThreshold = Math.min(
      sameDirectionThreshold,
      this.#clamp(
        cfg.oppositeDirectionThreshold,
        -1,
        1,
        -0.35,
      ),
    );
    const mode = alignment >= sameDirectionThreshold
      ? "same_direction"
      : alignment <= oppositeDirectionThreshold
        ? "opposite_direction"
        : "side";

    return Object.freeze({
      mode,
      alignment,
      projectionSpeedPxPerSec,
      fishSpeedPxPerSec,
      controlAxisX: normalizedAxisX,
      controlAxisY: normalizedAxisY,
    });
  }

  #createResult(overrides = {}) {
    return Object.freeze({
      mode: "side",
      alignment: 0,
      projectionSpeedPxPerSec: 0,
      fishSpeedPxPerSec: 0,
      controlAxisX: 0,
      controlAxisY: 0,
      ...overrides,
    });
  }

  #clamp(value, min, max, fallback = 0) {
    const number = Number(value);
    const resolved = Number.isFinite(number) ? number : fallback;
    return Math.max(min, Math.min(max, resolved));
  }
}
