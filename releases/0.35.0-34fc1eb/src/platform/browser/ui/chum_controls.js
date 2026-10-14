import { UiEventShield } from "../dom/ui_event_shield.js";

const CHUM_VISUAL_STATES = new Set(["disabled", "empty", "aiming", "moving", "ready"]);

export class ChumControls {
  #labels;

  constructor(onClickCallback, { labels, documentRef = document, mountNode = documentRef.body } = {}) {
    this.#labels = labels;
    this.button = documentRef.createElement("button");
    this.button.className = "game-control chum-control game-toolbar-button game-toolbar-button--chum";
    this.button.type = "button";
    this.button.setAttribute("aria-label", labels?.chumAction || "");
    this.button.innerText = "🍞";
    this.button.hidden = true;

    this.currentState = "idle";
    this.currentMethod = "hand";

    UiEventShield.makeSolid(this.button);

    this.button.addEventListener("click", (e) => {
      if (
        this.button.hidden ||
        this.currentState === "disabled" ||
        this.currentState === "empty" ||
        this.currentState === "moving"
      ) {
        return;
      }
      if (onClickCallback) onClickCallback(e);
    });

    mountNode.appendChild(this.button);
  }

  setState(state, method = "hand", count = 0, isManual = false, isVisible = true) {

    let text = "";
    if (state === "empty") {
      text = "🔘";
    } else if (state === "moving") {
      text = "⏩";
    } else if (state === "aiming") {
      text = "🚫";
    } else {
      // Keep quantities in the accessible label; the toolbar contains only icons.
      if (method === "boat") {
        text = "🚤";
      } else {
        text = "🍞";
      }
    }

    const label = method === "boat"
      ? this.#labels?.chumBoatAction || ""
      : this.#labels?.chumActionCount(count) || "";
    // Skip DOM updates when the displayed state has not changed.
    if (
      this.currentState === state &&
      this.currentMethod === method &&
      this.button.hidden === !isVisible &&
      this.button.innerText === text &&
      this.button.title === label
    ) {
      return;
    }

    this.currentState = state;
    this.currentMethod = method;
    this.button.hidden = !isVisible;
    this.button.innerText = text;
    this.button.title = label;
    this.button.setAttribute("aria-label", label);

    const visualState = CHUM_VISUAL_STATES.has(state)
      ? state
      : "idle";
    this.button.className = "game-control game-toolbar-button game-toolbar-button--chum chum-control chum-control--" + visualState;
  }

  dispose() {
    this.button?.remove();
    this.button = null;
  }
}

