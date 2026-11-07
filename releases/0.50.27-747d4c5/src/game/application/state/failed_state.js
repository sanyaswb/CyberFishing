import { GameState } from "./game_state.js";

export class FailedState extends GameState {
  /** @param {FailedStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  enter(data) {
    if (super.enter) super.enter();
    this.data = data || {};
    this.deps.ui.updateContinueButtonState(true);

    const eq = this.deps.inventory.getEquipped();
    const reason = this.data?.reason;

    this.deps.fishing.applyFailureEquipmentLoss(reason, eq, this.data?.failure || this.data || {});
  }

  exit() {
    this.deps.ui.updateContinueButtonState(false);
  }

  getRenderState(target, bounds) {
    target.stateName = "failed";
    target.fishing.visible = true;
    target.fishing.state = "failed";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = 0;
    target.outcome.visible = true;
    target.outcome.mode = "failed";
    target.outcome.reason = this.data.reason;
  }
}
