import { clampUnitFinite, nonNegativeOr } from "../../../engine/math/number_normalization.js";

// Stateless policy. The fight tension stage owns relief accumulated during one uninterrupted motion.
export class RodSideTensionCompensation {
  calculate({ previousReliefKg, tensionKg, rodLimitKg, dtSec, rodMotion, rodControlConfig }) {
    const cfg = rodControlConfig?.tension?.towardFishCompensation;
    const delta = Number(rodMotion?.deltaPx) || 0;
    const towardFish = Math.sign(delta) === Math.sign(Number(rodMotion?.fishOffsetX) || 0);
    if (rodControlConfig?.enabled === false || rodControlConfig?.alignment?.enabled !== false ||
        cfg?.enabled !== true || !rodMotion?.drivenByInput || !towardFish ||
        Math.abs(delta) <= nonNegativeOr(cfg.movementEpsilonPx) || !(dtSec > 0)) return 0;
    const tension = nonNegativeOr(tensionKg);
    const limit = nonNegativeOr(rodLimitKg);
    if (limit <= 0 || tension <= 0) return 0;
    const load = tension / limit;
    const rate = nonNegativeOr(cfg.ratePerSecond) * Math.pow(load, nonNegativeOr(cfg.loadCurvePower));
    if (rate <= 0) return 0;
    const duration = dtSec * clampUnitFinite(rodMotion.movementRatio ?? 1);
    // Exact integration of relief toward the current load, independent of the frame rate at constant load.
    const previous = Math.min(tension, nonNegativeOr(previousReliefKg));
    return previous + (tension - previous) * (1 - Math.exp(-rate * duration));
  }
}
