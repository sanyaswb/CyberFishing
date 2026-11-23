import { GameState } from "./game_state.js";

// The caught fish's outcome (spec 161): the victory window shows it and reports the player's action (claim or release);
// the state resolves the catch once and returns to scouting. The window, not a canvas hit test, owns the buttons.
export class VictoryState extends GameState {
  #catchId = null;
  #resolved = false;

  /** @param {VictoryStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  enter(data) {
    this.data = data || {};
    this.#catchId = this.deps.liveBait?.createCatchId?.() ?? null;
    this.#resolved = false;
    this.deps.ui.updateContinueButtonState(false);
    this.deps.ui.setOutcomeOverlayActive(true);
    this.deps.victoryWindow.show(this.data.fish || {}, { onAction: (action) => this.resolve(action) });
  }

  exit() {
    this.deps.victoryWindow.hide();
    this.deps.ui.updateContinueButtonState(false);
    this.deps.ui.setOutcomeOverlayActive(false);
  }

  // The window's action: "claim" or "release". A failed save keeps the window open with its reason reported.
  resolve(action) {
    if (this.#resolved || (action !== "claim" && action !== "release")) return;
    let result;
    if (this.deps.liveBait) {
      result = this.deps.liveBait.resolveCatch(this.#catchId, this.data.fish || {}, action);
      if (!result.ok) {
        this.deps.onCatchResult?.(result);
        return;
      }
    }
    this.#resolved = true;
    this.deps.commands.setState("scouting");
    if (result) this.deps.onCatchResult?.(result);
  }

  // Pointer input belongs to the window's buttons.
  handleInput() {}

  getRenderState(target, bounds) {
    target.stateName = "victory";
    target.fishing.visible = true;
    target.fishing.state = "victory";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = 0;
    target.outcome.visible = true;
    target.outcome.mode = "victory";
  }
}
