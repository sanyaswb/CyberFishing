import { UiEventShield } from "../dom/ui_event_shield.js";

const CHUM_VISUAL_STATES = new Set(["disabled", "empty", "aiming", "moving", "ready", "boat-empty"]);

export class ChumControls {
  #labels;
  #documentRef;
  #image = null;
  #boatIconUrl = null;

  constructor(onClickCallback, { labels, documentRef = document, mountNode = documentRef.body } = {}) {
    this.#labels = labels;
    this.#documentRef = documentRef;
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
        (this.currentState === "empty" && this.currentMethod !== "boat") ||
        this.currentState === "moving"
      ) {
        return;
      }
      if (onClickCallback) onClickCallback(e);
    });

    mountNode.appendChild(this.button);
  }

  setState(state, method = "hand", count = 0, isManual = false, isVisible = true, boatIconUrl = null) {

    let text = "";
    if (state === "empty") {
      text = method === "boat" ? "🚤" : "🔘";
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
    const isImageMode = method === "boat" && Boolean(boatIconUrl) && text === "🚤";
    // Skip DOM updates when the displayed state has not changed.
    if (
      this.currentState === state &&
      this.currentMethod === method &&
      this.#boatIconUrl === boatIconUrl &&
      this.button.hidden === !isVisible &&
      (isImageMode ? this.#image?.src === boatIconUrl : this.button.innerText === text) &&
      this.button.title === label
    ) {
      return;
    }

    this.currentState = state;
    this.currentMethod = method;
    this.#boatIconUrl = boatIconUrl;
    this.button.hidden = !isVisible;
    this.button.title = label;
    this.button.setAttribute("aria-label", label);

    if (method === "boat" && boatIconUrl && text === "🚤" && typeof this.#documentRef?.createElement === "function") {
      if (!this.#image) {
        this.#image = this.#documentRef.createElement("img");
        this.#image.className = "chum-control__image";
        this.#image.setAttribute("aria-hidden", "true");
        this.#image.alt = "";
      }
      this.#image.src = boatIconUrl;
      if (typeof this.button.replaceChildren === "function") {
        this.button.replaceChildren(this.#image);
      } else if (typeof this.button.appendChild === "function") {
        if (typeof this.button.innerHTML === "string") this.button.innerHTML = "";
        this.button.appendChild(this.#image);
      } else {
        this.button.innerText = text;
      }
    } else {
      if (this.#image?.remove) {
        this.#image.remove();
      }
      this.button.innerText = text;
    }

    const visualState = (method === "boat" && state === "empty")
      ? "boat-empty"
      : CHUM_VISUAL_STATES.has(state)
        ? state
        : "idle";
    this.button.className = "game-control game-toolbar-button game-toolbar-button--chum chum-control chum-control--" + visualState;
  }

  dispose() {
    this.button?.remove();
    this.button = null;
  }
}

