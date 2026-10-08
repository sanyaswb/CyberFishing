import { GameState } from "./game_state.js";

export class VictoryState extends GameState {
  #entryPointerGestureId = 0;

  /** @param {VictoryStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  enter(data) {
    this.data = data || {};
    this.#entryPointerGestureId = this.deps.input.getPointerGestureId();
    this.deps.ui.updateContinueButtonState(false);
    this.deps.ui.setOutcomeOverlayActive(true);
  }

  exit() {
    this.deps.ui.updateContinueButtonState(false);
    this.deps.ui.setOutcomeOverlayActive(false);
  }

  handleInput(input) {
    if (!input?.pointerReleased) return;

    const viewport = this.deps.getViewportSize();
    const fish = this.data.fish || {};
    const extraStats = Array.isArray(fish.victoryStats)
      ? fish.victoryStats.length
      : 0;
    const actions = this.deps.victoryLayoutResolver.resolve({
      width: viewport.width,
      height: viewport.height,
      config: this.deps.config.ui?.victory || {},
      statCount: 3 + extraStats,
    });
    const action = this.deps.victoryActionGestureResolver.resolve({
      input,
      entryGestureId: this.#entryPointerGestureId,
      actions,
    });
    if (!action) return;

    input.pointerReleased = false;
    this.deps.commands.setState("scouting");
  }

  getRenderState(target, bounds) {
    target.stateName = "victory";
    target.fishing.visible = true;
    target.fishing.state = "victory";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = 0;
    target.outcome.visible = true;
    target.outcome.mode = "victory";
    target.outcome.fish = this.data.fish || {};
  }
}
