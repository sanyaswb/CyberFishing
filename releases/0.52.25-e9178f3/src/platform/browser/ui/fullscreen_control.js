import { UiEventShield } from "../dom/ui_event_shield.js";
import { BrowserFullscreen } from "./browser_fullscreen.js";

export class FullscreenControl {
  #document;
  #fullscreen;
  #onError;
  #active = null;
  #onClick = async () => {
    try { await this.#fullscreen.request(); }
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
    // Spec 173 F1: the request itself is shared with the DEV zone editor (a wrapper over the injected document).
    this.#fullscreen = new BrowserFullscreen({ documentRef: fullscreenDocument });
    this.#onError = onError;
    this.button = documentRef.createElement("button");
    this.button.className = "hud-control hud-control--square game-control game-control--fullscreen";
    this.button.type = "button";
    this.button.innerHTML = "⛶";
    this.button.setAttribute("aria-label", label);
    this.button.title = label;
    this.button.hidden = !this.#fullscreen.supported;
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
