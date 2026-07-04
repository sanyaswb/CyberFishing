class StaminaPressureResolver {
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
      Math.max(0.001, this.#positive(lateralWeights.curvePower, 1)),
    );
    const holdDrainMultiplier =
      lateralWeights.enabled === false
        ? 1
        : this.#lerp(
            this.#positive(lateralWeights.centerHoldMultiplier, 1),
            this.#positive(lateralWeights.edgeHoldMultiplier, 0.1),
            edgeCurve,
          );
    const controlDrainMultiplier =
      lateralWeights.enabled === false
        ? 1
        : this.#lerp(
            this.#positive(lateralWeights.centerControlMultiplier, 0.1),
            this.#positive(lateralWeights.edgeControlMultiplier, 1),
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
      : this.#positive(rodHoldKg) *
        this.#positive(inputWeights.rodHold, 1) *
        holdDrainMultiplier;
    const reelHoldPressureKg = disabledByFatigue
      ? 0
      : this.#positive(reelHoldKg) *
        this.#positive(inputWeights.reelHold, 1) *
        holdDrainMultiplier;
    const controlPressureKg = disabledByFatigue
      ? 0
      : this.#positive(controlKg) *
        this.#positive(inputWeights.control, 1) *
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
        controlCenteringFactor: this.#positive(config.neutralMultiplier, 0.5),
        controlDirectionState: "neutral",
      });
    }
    if (inputDirection === 0) {
      return Object.freeze({
        controlCenteringFactor: this.#positive(config.neutralMultiplier, 0.5),
        controlDirectionState: "no_input",
      });
    }
    const centering = inputDirection === expectedDirection;
    return Object.freeze({
      controlCenteringFactor: centering
        ? this.#positive(config.centeringMultiplier, 1)
        : this.#positive(config.wrongDirectionMultiplier, 0.15),
      controlDirectionState: centering ? "centering" : "wrong",
    });
  }

  #lerp(a, b, t) {
    return a + (b - a) * this.#clamp01(t);
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }
}

if (typeof window !== "undefined") {
  window.StaminaPressureResolver = StaminaPressureResolver;
}
