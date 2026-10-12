import { clampUnitFinite, nonNegativeOr } from "../../../../engine/math/number_normalization.js";

export class ActiveEnduranceDrainCalculator {
  calculate({
    activePressureRatio = 0,
    dtSec = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const ratio = clampUnitFinite(activePressureRatio);
    const curvePower = Math.max(0.001, nonNegativeOr(config.curvePower, 1));
    const curvedRatio = Math.pow(ratio, curvePower);
    const drainPerSecondBase = enabled
      ? nonNegativeOr(config.drainPerSecond, 80)
      : 0;
    const dt = nonNegativeOr(dtSec);
    const activeEnduranceDrainPerSecond = drainPerSecondBase * curvedRatio;
    const activeEnduranceDrain = activeEnduranceDrainPerSecond * dt;

    return Object.freeze({
      enabled,
      activePressureRatio: ratio,
      activeEnduranceDrainRatio: ratio,
      curvedActiveEnduranceDrainRatio: curvedRatio,
      activeEnduranceDrainPerSecond,
      activeEnduranceDrain,
      curvePower,
      dtSec: dt,
    });
  }
}
