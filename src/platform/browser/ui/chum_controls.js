import { UiEventShield } from "../dom/ui_event_shield.js";

const CHUM_VISUAL_STATES = new Set(["disabled", "empty", "aiming", "moving", "ready"]);

export class ChumControls {
  constructor(onClickCallback) {
    this.button = document.createElement("button");
    this.button.className = "game-control chum-control";
    this.button.innerText = "🍞";

    this.currentState = "idle";
    this.currentMethod = "hand";

    UiEventShield.makeSolid(this.button);

    this.button.addEventListener("click", (e) => {
      if (
        this.currentState === "disabled" ||
        this.currentState === "empty" ||
        this.currentState === "moving"
      ) {
        return;
      }
      if (onClickCallback) onClickCallback(e);
    });

    document.body.appendChild(this.button);
  }

  setState(state, method = "hand", count = 0, isManual = false) {

    let text = "";
    if (state === "empty") {
      text = "🔘";
    } else if (state === "moving") {
      text = "⏩";
    } else if (state === "aiming") {
      text = "🚫";
    } else {
      // The boat shows only its icon; hand chum also shows the remaining amount.
      if (method === "boat") {
        text = "🚤";
      } else {
        text = `🍞(${count})`;
      }
    }

    // Skip DOM updates when the displayed state has not changed.
    if (
      this.currentState === state &&
      this.currentMethod === method &&
      this.button.innerText === text
    ) {
      return;
    }

    this.currentState = state;
    this.currentMethod = method;
    this.button.innerText = text;

    const visualState = CHUM_VISUAL_STATES.has(state)
      ? state
      : "idle";
    this.button.className = "game-control chum-control chum-control--" + visualState;
  }

  dispose() {
    this.button?.remove();
    this.button = null;
  }
}

