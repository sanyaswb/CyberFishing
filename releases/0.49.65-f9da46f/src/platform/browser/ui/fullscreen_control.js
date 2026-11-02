import { UiEventShield } from "../dom/ui_event_shield.js";

export class FullscreenControl {
  #document;
  #onError;
  #active = null;
  #onClick = async () => {
    if (this.#document.fullscreenElement) return;
    try { await this.#document.documentElement.requestFullscreen(); }
    catch (error) { this.#onError?.(error); }
  };
  #onChange = () => {
    const active = Boolean(this.#document.fullscreenElement);
    if (this.#active === active) return;
    this.#active = active;
    this.button.classList.toggle("game-control--fullscreen-hidden", active);
    this.button.disabled = active;
    this.button.setAttribute("aria-hidden", String(active));
  };

  constructor({ documentRef, mountNode, fullscreenDocument = documentRef, label, onError = null }) {
    this.#document = fullscreenDocument;
    this.#onError = onError;
    this.button = documentRef.createElement("button");
    this.button.className = "hud-control hud-control--square game-control game-control--fullscreen";
    this.button.type = "button";
    this.button.innerHTML = "⛶";
    this.button.setAttribute("aria-label", label);
    this.button.title = label;
    this.button.hidden = typeof fullscreenDocument.documentElement?.requestFullscreen !== "function";
    UiEventShield.makeSolid(this.button);
    this.button.addEventListener("click", this.#onClick);
    fullscreenDocument.addEventListener("fullscreenchange", this.#onChange);
    mountNode.appendChild(this.button);
    this.#onChange();
  }

  dispose() {
    if (!this.button) return;
    this.#document.removeEventListener("fullscreenchange", this.#onChange);
    this.button.removeEventListener("click", this.#onClick);
    this.button.remove();
    this.button = null;
  }
}
