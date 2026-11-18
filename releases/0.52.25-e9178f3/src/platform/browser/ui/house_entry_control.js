import { UiEventShield } from "../dom/ui_event_shield.js";

// Spec 179 D12 (TK-371, owner Q2): the HUD's house button in the top-left corner (where the DEV page had its DevTools
// button). A click asks to go into the house; whether the player may (the tackle put away) is the caller's.
export class HouseEntryControl {
  #onClick;

  constructor({ documentRef, mountNode, label, onEnter }) {
    if (typeof onEnter !== "function") throw new TypeError("HouseEntryControl requires onEnter");
    this.#onClick = () => onEnter();
    this.button = documentRef.createElement("button");
    this.button.className = "hud-control hud-control--square game-control game-control--house";
    this.button.type = "button";
    this.button.textContent = "⌂";
    this.button.setAttribute("aria-label", label);
    this.button.title = label;
    UiEventShield.makeSolid(this.button);
    this.button.addEventListener("click", this.#onClick);
    mountNode.appendChild(this.button);
  }

  dispose() {
    if (!this.button) return;
    this.button.removeEventListener("click", this.#onClick);
    this.button.remove();
    this.button = null;
  }
}
