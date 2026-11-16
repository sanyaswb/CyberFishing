import { UiEventShield } from "../dom/ui_event_shield.js";

const SVG = "http://www.w3.org/2000/svg";

// Spec 142 D12, spec 181 stage F: the radio's indicator, the first (informational) circle of the HUD indicator column
// (the shared hud-indicator component). Shown while a radio is worn; its state modifier follows the radio's status (off,
// playing, weak, empty). While it sounds an oscilloscope wave moves inside (CSS only); otherwise the inventory's radio
// drawing stands there (owner, 2026-11-16). Its fill is the worn battery's charge: the level from the bottom and the
// degradation colour of that charge (chargeColor). A tap opens the radio's editor. Writes only on change.
export class RadioHudIndicator {
  #button;
  #fill;
  #unsubscribe;
  #labels;
  #chargeColor;
  #state = null;
  #sounding = null;
  #visible = null;
  #title = null;
  #charge;

  // iconUrl: the inventory's radio drawing (asset ui.inventory.radio); chargeColor: (percent) => a CSS colour.
  constructor({ documentRef, mountNode, radio, labels, onActivate, iconUrl, chargeColor }) {
    this.#labels = labels;
    this.#chargeColor = chargeColor;
    const button = documentRef.createElement("button");
    button.type = "button";
    button.className = "hud-indicator hud-indicator--radio";
    button.hidden = true;
    UiEventShield.makeSolid(button);
    const fill = documentRef.createElement("span");
    fill.className = "hud-indicator__fill hud-indicator__fill--level";
    const image = documentRef.createElement("img");
    image.className = "hud-indicator__image";
    image.src = iconUrl;
    image.alt = "";
    image.draggable = false;
    const svg = documentRef.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 40 40");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "hud-indicator__icon");
    const wave = documentRef.createElementNS(SVG, "path");
    wave.setAttribute("class", "hud-indicator__wave");
    wave.setAttribute("d", "M-20 20 q5 -9 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0");
    svg.append(wave);
    button.append(fill, image, svg);
    button.addEventListener("click", () => onActivate?.());
    // Spec 181 D3: the first of the HUD indicator column (it arrives after the first frame, statuses may be there).
    mountNode.prepend(button);
    this.#button = button;
    this.#fill = fill;
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
    const sounding = status.status === "playing" || status.status === "no-effect";
    const weakSignal = Number(status.signal ?? 1) < 1;
    const state = status.status === "no-battery" ? "empty"
      : sounding && !weakSignal ? "playing"
        : status.powered ? "weak" : "off";
    if (state !== this.#state) {
      if (this.#state) this.#button.classList.remove(`hud-indicator--${this.#state}`);
      this.#button.classList.add(`hud-indicator--${state}`);
      this.#state = state;
    }
    if (sounding !== this.#sounding) {
      this.#sounding = sounding;
      this.#button.classList.toggle("hud-indicator--sounding", sounding);
    }
    const charge = Number.isFinite(status.charge) ? status.charge : null;
    if (charge !== this.#charge) {
      this.#charge = charge;
      this.#fill.style.setProperty("--hud-indicator-level", String((charge ?? 0) / 100));
      this.#fill.style.setProperty("--hud-indicator-color-full", charge === null ? "transparent" : this.#chargeColor(charge));
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
