import { UiEventShield } from "../dom/ui_event_shield.js";

const SVG = "http://www.w3.org/2000/svg";

// Spec 142 D12: the radio's indicator under the clock, an oscilloscope wave in a 40 x 40 circle (the shared
// hud-indicator component). Shown while a radio is worn; its state modifier follows the radio's status (off, playing,
// weak, empty); the wave moves by CSS only while playing. A tap opens the radio's editor. Writes only on change.
export class RadioHudIndicator {
  #button;
  #unsubscribe;
  #labels;
  #state = null;
  #visible = null;
  #title = null;

  constructor({ documentRef, mountNode, radio, labels, onActivate }) {
    this.#labels = labels;
    const button = documentRef.createElement("button");
    button.type = "button";
    button.className = "hud-indicator hud-indicator--radio";
    button.hidden = true;
    UiEventShield.makeSolid(button);
    const svg = documentRef.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 40 40");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "hud-indicator__icon");
    const wave = documentRef.createElementNS(SVG, "path");
    wave.setAttribute("class", "hud-indicator__wave");
    wave.setAttribute("d", "M-20 20 q5 -9 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0");
    svg.append(wave);
    button.append(svg);
    button.addEventListener("click", () => onActivate?.());
    mountNode.appendChild(button);
    this.#button = button;
    this.#unsubscribe = radio.subscribe((status) => this.#update(status));
    this.#update(radio.getStatus());
  }

  dispose() {
    this.#unsubscribe?.();
    this.#button?.remove();
    this.#button = null;
  }

  #update(status) {
    const visible = status.equipped === true;
    if (visible !== this.#visible) {
      this.#visible = visible;
      this.#button.hidden = !visible;
    }
    const state = status.status === "no-battery" ? "empty"
      : status.status === "playing" || status.status === "no-effect" ? "playing"
        : status.powered ? "weak" : "off";
    if (state !== this.#state) {
      if (this.#state) this.#button.classList.remove(`hud-indicator--${this.#state}`);
      this.#button.classList.add(`hud-indicator--${state}`);
      this.#state = state;
    }
    const statusText = this.#labels.status[status.status] || status.status;
    const title = this.#labels.indicator(statusText, status.station?.name || "");
    if (title !== this.#title) {
      this.#title = title;
      this.#button.title = title;
      this.#button.setAttribute("aria-label", title);
    }
  }
}
