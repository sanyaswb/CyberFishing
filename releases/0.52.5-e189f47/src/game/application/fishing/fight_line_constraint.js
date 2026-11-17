import { LineConstraintStateResolver } from "../../domain/fishing/line_constraint_state_resolver.js";
import { hasLineReserve } from "../../domain/fishing/line_state_queries.js";

// The fight's line constraint state for a step: released, remaining and payout context resolved against the
// live line-constraint settings. Shared by the fish motion, rod movement and line recovery stages.
export class FightLineConstraint {
  #lineConstraintStateResolver = new LineConstraintStateResolver();
  #config;
  #physicsConfig;

  constructor({ config, physicsConfig }) {
    this.#config = config;
    this.#physicsConfig = physicsConfig;
  }

  resolveLineConstraintState({
    lineState,
    dragContext,
    fishRetrieveResult,
    payoutResult = null,
    config = null,
  } = {}) {
    const payoutContext = this.#buildLinePayoutContext({
      lineState,
      dragContext,
      fishRetrieveResult,
      payoutResult,
    });
    return this.#lineConstraintStateResolver.resolve({
      lineState,
      payoutContext,
      config: this.#getLineConstraintConfig(config),
    });
  }

  #getLineConstraintConfig(config = null) {
    if (config?.lineConstraint) return config.lineConstraint;
    if (
      config &&
      (
        Object.prototype.hasOwnProperty.call(config, "tautThresholdRatio") ||
        Object.prototype.hasOwnProperty.call(config, "epsilonMeters") ||
        Object.prototype.hasOwnProperty.call(config, "projectLockedMovementToArc")
      )
    ) {
      return config;
    }
    return (
      this.#physicsConfig?.getRodControlConfig?.()?.lineConstraint ||
      this.#getRuntimePhysicsConfig()?.fight?.rodControl?.lineConstraint ||
      {}
    );
  }

  #buildLinePayoutContext({
    lineState,
    dragContext,
    fishRetrieveResult,
    payoutResult,
  }) {
    const lineHasReserve = hasLineReserve(lineState);
    const dragSupported = !!dragContext?.dragSupported;
    const dragLocked = dragContext?.dragLocked !== false;
    const dragOpen = dragContext?.dragOpen === true;
    const dragSlipResolved = fishRetrieveResult?.shouldSlipDrag === true;
    const dragCanPayout =
      lineHasReserve &&
      dragSupported &&
      !dragLocked &&
      (dragOpen || dragSlipResolved);
    const dragPayoutBlocked =
      lineHasReserve && !dragCanPayout;

    return Object.freeze({
      lineHasReserve,
      dragCanPayout,
      dragPayoutBlocked,
      dragOpen,
      dragSlipResolved,
      payoutOccurred: payoutResult?.didSlip === true,
      payoutBlockedReason:
        payoutResult?.releaseBlockedReason || "none",
      reason: !lineHasReserve
        ? "spool_empty"
        : dragCanPayout
          ? "none"
          : "drag_holding",
    });
  }

  #getRuntimePhysicsConfig() {
    return this.#config.physics || {};
  }
}
