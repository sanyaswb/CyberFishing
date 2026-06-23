/**
 * Decides whether landing lift has enough real-weight support to resolve catch.
 *
 * This policy is pure gameplay logic: it does not read debug data, DOM, canvas,
 * stress meters or mutable entity state.
 */
class LandingLiftReadinessPolicy {
  evaluate({
    landingLiftFrame = null,
    tensionFrame = null,
    config = {},
    epsilonKg = 0.001,
  } = {}) {
    const liftConfig = config || {};
    const enabled = liftConfig.enabled !== false;
    if (!enabled) {
      return this.#freeze({
        ready: true,
        reason: "landing_lift_disabled",
        liftRequiredKg: 0,
        liftHoldKg: 0,
        supportedTensionKg: 0,
        rawTensionKg: 0,
        visibleTensionKg: 0,
        dragSlipping: false,
      });
    }

    const liftRequiredKg = this.#positive(landingLiftFrame?.liftMaxKg);
    const liftHoldKg = this.#positive(landingLiftFrame?.liftHoldKg);
    const supportedTensionKg = this.#positive(
      tensionFrame?.supportedTensionKg ?? tensionFrame?.totalTensionKg,
    );
    const rawTensionKg = this.#positive(
      tensionFrame?.rawTensionKg ?? tensionFrame?.rawTotalTensionKg,
    );
    const visibleTensionKg = this.#positive(
      tensionFrame?.visibleTensionKg ?? tensionFrame?.tensionKg,
    );
    const dragSlipping =
      tensionFrame?.shouldSlipDrag === true ||
      tensionFrame?.dragSlipping === true;
    const epsilon = Math.max(0, Number(epsilonKg) || 0);

    if (!landingLiftFrame?.inLandingZone) {
      return this.#notReady({
        reason: "outside_landing_zone",
        liftRequiredKg,
        liftHoldKg,
        supportedTensionKg,
        rawTensionKg,
        visibleTensionKg,
        dragSlipping,
      });
    }

    if (!landingLiftFrame?.playerHoldActive) {
      return this.#notReady({
        reason: "hold_inactive",
        liftRequiredKg,
        liftHoldKg,
        supportedTensionKg,
        rawTensionKg,
        visibleTensionKg,
        dragSlipping,
      });
    }

    if (!landingLiftFrame?.active || liftRequiredKg <= 0) {
      return this.#notReady({
        reason: "lift_inactive",
        liftRequiredKg,
        liftHoldKg,
        supportedTensionKg,
        rawTensionKg,
        visibleTensionKg,
        dragSlipping,
      });
    }

    if (liftHoldKg < liftRequiredKg - epsilon) {
      return this.#notReady({
        reason: "lift_not_charged",
        liftRequiredKg,
        liftHoldKg,
        supportedTensionKg,
        rawTensionKg,
        visibleTensionKg,
        dragSlipping,
      });
    }

    if (supportedTensionKg < liftRequiredKg - epsilon) {
      return this.#notReady({
        reason: dragSlipping ? "drag_slipping" : "supported_tension_low",
        liftRequiredKg,
        liftHoldKg,
        supportedTensionKg,
        rawTensionKg,
        visibleTensionKg,
        dragSlipping,
      });
    }

    return this.#freeze({
      ready: true,
      reason: "ready",
      liftRequiredKg,
      liftHoldKg,
      supportedTensionKg,
      rawTensionKg,
      visibleTensionKg,
      dragSlipping,
    });
  }

  #notReady(data) {
    return this.#freeze({
      ready: false,
      ...data,
    });
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, number);
    return Math.max(0, Number(fallback) || 0);
  }

  #freeze(data) {
    return Object.freeze(data);
  }
}

if (typeof window !== "undefined") {
  window.LandingLiftReadinessPolicy = LandingLiftReadinessPolicy;
}
