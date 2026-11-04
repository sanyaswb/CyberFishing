import { UiEventShield } from "../dom/ui_event_shield.js";

function phaseSymbol(hours) {
  if (hours >= 21 || hours < 5) return "moon";
  if (hours < 8) return "sunrise";
  if (hours >= 18) return "sunset";
  return "sun";
}

export class TimeDisplay {
  #onActivate;
  #onDoubleActivate;
  #activation;
  #labels;
  #enabled = null;
  #multiplier = null;
  #speedSpan;
  #speedValue;
  #phaseSpan;
  #icons;
  // icons: create(symbol, className) of the shared sprite (TK-197).
  constructor({ documentRef = document, mount = documentRef.body, onActivate = null, onDoubleActivate = null,
    activationController = null, labels = {}, icons } = {}) {
    if (typeof icons?.create !== "function") throw new TypeError("TimeDisplay requires icons");
    this.#icons = icons;
    this.#onActivate = onActivate;
    this.#onDoubleActivate = onDoubleActivate;
    this.#activation = activationController;
    this.#labels = labels;
    this.container = documentRef.createElement(onActivate || onDoubleActivate ? "button" : "div");
    this.container.className = "hud-control time-display";
    UiEventShield.makeSolid(this.container);
    this.container.style.pointerEvents = "";
    this.container.style.touchAction = "";
    if (onActivate || onDoubleActivate) {
      this.container.type = "button";
      this.container.disabled = true;
      if (activationController) activationController.attach(this.container, { onSingle: () => {
        if (this.#enabled) onActivate?.();
      }, onDouble: () => { if (this.#enabled) this.#onDoubleActivate?.(); } });
      else if (onActivate) this.container.addEventListener("click", onActivate);
    }
    if (onActivate) {
      this.#speedSpan = documentRef.createElement("span");
      this.#speedSpan.className = "time-display__speed";
      this.#speedSpan.setAttribute("aria-hidden", "true");
      this.#speedSpan.hidden = true;
      this.#speedValue = documentRef.createElement("span");
      this.#speedSpan.append(icons.create("fast-forward", "time-display__speed-icon"), this.#speedValue);
      this.container.appendChild(this.#speedSpan);
    }

    this.phaseSymbol = null;
    this.#phaseSpan = documentRef.createElement("span");
    this.#phaseSpan.className = "time-display__phase";
    this.timeSpan = documentRef.createElement("span");
    this.timeSpan.className = "time-display__time";

    this.container.appendChild(this.#phaseSpan);
    this.container.appendChild(this.timeSpan);
    mount.appendChild(this.container);
  }

  setControlState(enabled, multiplier) {
    if (!this.#onActivate && !this.#onDoubleActivate) return;
    if (enabled === this.#enabled && multiplier === this.#multiplier) return;
    if (enabled !== this.#enabled) {
      this.cancelActivation();
      this.container.disabled = !enabled;
      this.container.classList.toggle("time-display--interactive", enabled);
      this.#enabled = enabled;
    }
    if (multiplier !== this.#multiplier) {
      if (this.#speedSpan) {
        this.#speedSpan.hidden = multiplier === 1;
        this.#speedValue.textContent = multiplier === 1 ? "" : `×${multiplier}`;
      }
      this.container.classList.toggle("time-display--accelerated", multiplier > 1);
      this.#multiplier = multiplier;
    }
    this.#updateLabel();
  }

  #updateLabel() {
    const description = this.#labels.timeAcceleration?.(this.#multiplier, this.#enabled);
    const phase = this.#enabled && this.#onDoubleActivate ? this.#labels.timePhase : "";
    const label = [this.timeSpan.innerText || "", description, phase].filter(Boolean).join(" · ");
    if (label && this.container.getAttribute("aria-label") !== label) this.container.setAttribute("aria-label", label);
  }

  update(gameTimeHours) {
    const h = Math.floor(gameTimeHours);
    const m = Math.floor((gameTimeHours % 1) * 60);
    const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

    if (this.timeSpan.innerText !== timeStr) {
      this.timeSpan.innerText = timeStr;
      const symbol = phaseSymbol(gameTimeHours);
      if (symbol !== this.phaseSymbol) {
        this.phaseSymbol = symbol;
        this.#phaseSpan.replaceChildren(this.#icons.create(symbol, "time-display__icon"));
      }
      if (this.#onActivate || this.#onDoubleActivate) this.#updateLabel();
    }
  }

  cancelActivation() { this.#activation?.cancel(this.container); }

  dispose() {
    this.#activation?.detach(this.container);
    if (this.#onActivate) this.container?.removeEventListener("click", this.#onActivate);
    this.#onActivate = null;
    this.#onDoubleActivate = null;
    this.#speedSpan = null;
    this.#speedValue = null;
    this.#phaseSpan = null;
    this.container?.remove();
    this.container = null;
    this.timeSpan = null;
  }
}
