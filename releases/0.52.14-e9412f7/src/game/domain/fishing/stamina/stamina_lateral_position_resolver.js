import { clampUnitFinite, nonNegativeOr } from "../../../../engine/math/number_normalization.js";

export class StaminaLateralPositionResolver {
  resolve({
    fishLateralOffsetPx = 0,
    maxAllowedLateralOffsetPx = 0,
    angleRatio = null,
    config = {},
  } = {}) {
    const offset = Number(fishLateralOffsetPx) || 0;
    const absOffset = Math.abs(offset);
    const maxOffset = nonNegativeOr(maxAllowedLateralOffsetPx);
    const explicitRatio = Number(angleRatio);
    const lateralEdgeRatio =
      maxOffset > 0
        ? clampUnitFinite(absOffset / maxOffset)
        : Number.isFinite(explicitRatio)
          ? clampUnitFinite(explicitRatio)
          : 0;
    const fishSide = offset > 0 ? "right" : offset < 0 ? "left" : "center";
    const centerDeadZoneRatio = clampUnitFinite(config.centerDeadZoneRatio ?? 0);
    const expectedControlDirectionToCenter =
      lateralEdgeRatio <= centerDeadZoneRatio ? 0 : -Math.sign(offset);

    return Object.freeze({
      lateralEdgeRatio,
      fishSide,
      expectedControlDirectionToCenter,
      fishLateralOffsetPx: offset,
      maxAllowedLateralOffsetPx: maxOffset,
    });
  }
}
