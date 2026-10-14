import { StaminaLateralPositionResolver } from "./stamina_lateral_position_resolver.js";
import { clampUnitFinite, nonNegativeOr } from "../../../../engine/math/number_normalization.js";

export class StaminaPressureResolver {
  #lateralPositionResolver;

  constructor({
    lateralPositionResolver = new StaminaLateralPositionResolver(),
  } = {}) {
    this.#lateralPositionResolver = lateralPositionResolver;
  }

  resolve({
    rodHoldKg = 0,
    reelHoldKg = 0,
    controlKg = 0,
    controlExhausted = false,
    fishLateralContext = {},
    controlDirectionX = 0,
    config = {},
  } = {}) {
    const pressureConfig = config || {};
    const inputWeights = pressureConfig.inputWeights || {};
    const lateralWeights = pressureConfig.lateralPositionWeights || {};
    const directionConfig = pressureConfig.controlDirection || {};
    const lateralFrame = this.#lateralPositionResolver.resolve({
      fishLateralOffsetPx:
        fishLateralContext.fishLateralOffsetPx ??
        fishLateralContext.fishOffsetX,
      maxAllowedLateralOffsetPx:
        fishLateralContext.maxAllowedLateralOffsetPx ??
        fishLateralContext.maxOffsetPx,
      angleRatio: fishLateralContext.angleRatio,
      config: directionConfig,
    });
    const edgeCurve = Math.pow(
      lateralFrame.lateralEdgeRatio,
      Math.max(0.001, nonNegativeOr(lateralWeights.curvePower, 1)),
    );
    const holdDrainMultiplier =
      lateralWeights.enabled === false
        ? 1
        : this.#lerp(
            nonNegativeOr(lateralWeights.centerHoldMultiplier, 1),
            nonNegativeOr(lateralWeights.edgeHoldMultiplier, 0.1),
            edgeCurve,
          );
    const controlDrainMultiplier =
      lateralWeights.enabled === false
        ? 1
        : this.#lerp(
            nonNegativeOr(lateralWeights.centerControlMultiplier, 0.1),
            nonNegativeOr(lateralWeights.edgeControlMultiplier, 1),
            edgeCurve,
          );
    const directionFrame = this.#resolveControlDirection({
      inputDirectionX: controlDirectionX,
      lateralFrame,
      config: directionConfig,
    });
    const disabledByFatigue = controlExhausted === true;
    const rodHoldPressureKg = disabledByFatigue
      ? 0
      : nonNegativeOr(rodHoldKg) *
        nonNegativeOr(inputWeights.rodHold, 1) *
        holdDrainMultiplier;
    const reelHoldPressureKg = disabledByFatigue
      ? 0
      : nonNegativeOr(reelHoldKg) *
        nonNegativeOr(inputWeights.reelHold, 1) *
        holdDrainMultiplier;
    const controlPressureKg = disabledByFatigue
      ? 0
      : nonNegativeOr(controlKg) *
        nonNegativeOr(inputWeights.control, 1) *
        controlDrainMultiplier *
        directionFrame.controlCenteringFactor;
    const playerStaminaPressureKg =
      rodHoldPressureKg + reelHoldPressureKg + controlPressureKg;

    return Object.freeze({
      playerStaminaPressureKg,
      rodHoldStaminaPressureKg: rodHoldPressureKg,
      reelHoldStaminaPressureKg: reelHoldPressureKg,
      controlStaminaPressureKg: controlPressureKg,
      holdDrainMultiplier,
      controlDrainMultiplier,
      controlCenteringFactor: directionFrame.controlCenteringFactor,
      lateralEdgeRatio: lateralFrame.lateralEdgeRatio,
      fishSide: lateralFrame.fishSide,
      expectedControlDirectionToCenter:
        lateralFrame.expectedControlDirectionToCenter,
      controlDirectionState: directionFrame.controlDirectionState,
      controlExhausted: disabledByFatigue,
      fishLateralOffsetPx: lateralFrame.fishLateralOffsetPx,
      maxAllowedLateralOffsetPx: lateralFrame.maxAllowedLateralOffsetPx,
    });
  }

  #resolveControlDirection({ inputDirectionX, lateralFrame, config }) {
    if (config.enabled === false) {
      return Object.freeze({
        controlCenteringFactor: 1,
        controlDirectionState: "disabled",
      });
    }
    const inputDirection = Math.sign(Number(inputDirectionX) || 0);
    const expectedDirection = lateralFrame.expectedControlDirectionToCenter;
    if (expectedDirection === 0) {
      return Object.freeze({
        controlCenteringFactor: nonNegativeOr(config.neutralMultiplier, 0.5),
        controlDirectionState: "neutral",
      });
    }
    if (inputDirection === 0) {
      return Object.freeze({
        controlCenteringFactor: nonNegativeOr(config.neutralMultiplier, 0.5),
        controlDirectionState: "no_input",
      });
    }
    const centering = inputDirection === expectedDirection;
    return Object.freeze({
      controlCenteringFactor: centering
        ? nonNegativeOr(config.centeringMultiplier, 1)
        : nonNegativeOr(config.wrongDirectionMultiplier, 0.15),
      controlDirectionState: centering ? "centering" : "wrong",
    });
  }

  #lerp(a, b, t) {
    return a + (b - a) * clampUnitFinite(t);
  }
}
