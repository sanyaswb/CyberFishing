import { UiEventShield } from "../dom/ui_event_shield.js";

const CHUM_VISUAL_STATES = new Set(["disabled", "empty", "aiming", "moving", "ready", "boat-empty"]);

function chumSymbol(state, method) {
  if (state === "moving") return "fast-forward";
  if (state === "aiming") return "cancel";
  if (method === "boat") return "boat";
  return state === "empty" ? "chum-empty" : "chum";
}

export class ChumControls {
  #labels;
  #assets;
  #icons;
  #documentRef;
  #image = null;
  // What the button shows: a sprite symbol or the boat art's URL. The icon is rebuilt only when this changes.
  #visual = null;

  // assets: the AssetRegistry; setState names the boat's art by asset id (spec 157 R16).
  // icons: create(symbol, className) of the shared sprite (TK-197).
  constructor(onClickCallback, { labels, documentRef = document, mountNode = documentRef.body, assets, icons } = {}) {
    if (typeof assets?.pathOf !== "function") throw new TypeError("ChumControls requires assets");
    if (typeof icons?.create !== "function") throw new TypeError("ChumControls requires icons");
    this.#assets = assets;
    this.#icons = icons;
    this.#labels = labels;
    this.#documentRef = documentRef;
    this.button = documentRef.createElement("button");
    this.button.className = "game-control chum-control game-toolbar-button game-toolbar-button--chum";
    this.button.type = "button";
    this.button.setAttribute("aria-label", labels?.chumAction || "");
    this.button.hidden = true;

    this.currentState = "idle";
    this.currentMethod = "hand";
    this.currentSymbol = "chum";
    this.#showSymbol("chum");

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

  setState(state, method = "hand", count = 0, isManual = false, isVisible = true, boatIconAsset = null) {
    const boatIconUrl = boatIconAsset ? this.#assets.pathOf(boatIconAsset) : null;
    // Keep quantities in the accessible label; the toolbar contains only icons.
    const symbol = chumSymbol(state, method);
    const visual = symbol === "boat" && boatIconUrl ? boatIconUrl : symbol;
    const label = method === "boat"
      ? this.#labels?.chumBoatAction || ""
      : this.#labels?.chumActionCount(count) || "";
    // Skip DOM updates when the displayed state has not changed.
    if (
      this.currentState === state &&
      this.currentMethod === method &&
      this.#visual === visual &&
      this.button.hidden === !isVisible &&
      this.button.title === label
    ) {
      return;
    }

    this.currentState = state;
    this.currentMethod = method;
    this.currentSymbol = symbol;
    this.button.hidden = !isVisible;
    this.button.title = label;
    this.button.setAttribute("aria-label", label);

    if (visual !== this.#visual) {
      if (visual === symbol) this.#showSymbol(symbol);
      else this.#showImage(visual);
    }

    const visualState = (method === "boat" && state === "empty")
      ? "boat-empty"
      : CHUM_VISUAL_STATES.has(state)
        ? state
        : "idle";
    this.button.className = "game-control game-toolbar-button game-toolbar-button--chum chum-control chum-control--" + visualState;
  }

  #showSymbol(symbol) {
    this.#visual = symbol;
    this.button.replaceChildren(this.#icons.create(symbol, "game-toolbar-button__icon"));
  }

  #showImage(url) {
    this.#visual = url;
    if (!this.#image) {
      this.#image = this.#documentRef.createElement("img");
      this.#image.className = "chum-control__image";
      // Spec 157 R6: lazy before src, so a hidden image (closed inventory, hidden toolbar button) waits until it is shown.
      this.#image.loading = "lazy";
      this.#image.decoding = "async";
      this.#image.setAttribute("aria-hidden", "true");
      this.#image.alt = "";
    }
    this.#image.src = url;
    this.button.replaceChildren(this.#image);
  }

  dispose() {
    this.button?.remove();
    this.button = null;
  }
}
