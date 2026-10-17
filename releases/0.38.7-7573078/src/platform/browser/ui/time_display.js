import { UiEventShield } from "../dom/ui_event_shield.js";

export class TimeDisplay {
  #onActivate;
  #labels;
  #enabled = null;
  #multiplier = null;
  #speedSpan;
  constructor({ documentRef = document, mount = documentRef.body, onActivate = null, labels = {} } = {}) {
    this.#onActivate = onActivate;
    this.#labels = labels;
    this.container = documentRef.createElement(onActivate ? "button" : "div");
    this.container.className = "hud-control time-display";
    UiEventShield.makeSolid(this.container);
    this.container.style.pointerEvents = "";
    this.container.style.touchAction = "";
    if (onActivate) {
      this.container.type = "button";
      this.container.disabled = true;
      this.container.addEventListener("click", onActivate);
      this.#speedSpan = documentRef.createElement("span");
      this.#speedSpan.className = "time-display__speed";
      this.#speedSpan.setAttribute("aria-hidden", "true");
      this.#speedSpan.hidden = true;
      this.container.appendChild(this.#speedSpan);
    }

    this.emojiSpan = documentRef.createElement("span");
    this.timeSpan = documentRef.createElement("span");
    this.timeSpan.className = "time-display__time";

    this.container.appendChild(this.emojiSpan);
    this.container.appendChild(this.timeSpan);
    mount.appendChild(this.container);
  }

  setControlState(enabled, multiplier) {
    if (!this.#onActivate) return;
    if (enabled === this.#enabled && multiplier === this.#multiplier) return;
    if (enabled !== this.#enabled) {
      this.container.disabled = !enabled;
      this.container.classList.toggle("time-display--interactive", enabled);
      this.#enabled = enabled;
    }
    if (multiplier !== this.#multiplier) {
      this.#speedSpan.hidden = multiplier === 1;
      this.#speedSpan.textContent = multiplier === 1 ? "" : `⏩ ×${multiplier}`;
      this.container.classList.toggle("time-display--accelerated", multiplier > 1);
      this.#multiplier = multiplier;
    }
    this.#updateLabel();
  }

  #updateLabel() {
    const description = this.#labels.timeAcceleration?.(this.#multiplier, this.#enabled);
    const label = description ? `${this.timeSpan.innerText || ""} · ${description}` : "";
    if (label && this.container.getAttribute("aria-label") !== label) this.container.setAttribute("aria-label", label);
  }

  update(gameTimeHours) {
    const h = Math.floor(gameTimeHours);
    const m = Math.floor((gameTimeHours % 1) * 60);
    const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

    let emoji = "☀️";
    if (gameTimeHours >= 21 || gameTimeHours < 5) {
      emoji = "🌙";
    } else if (gameTimeHours >= 5 && gameTimeHours < 8) {
      emoji = "🌅";
    } else if (gameTimeHours >= 18 && gameTimeHours < 21) {
      emoji = "🌇";
    }

    if (this.timeSpan.innerText !== timeStr) {
      this.timeSpan.innerText = timeStr;
      this.emojiSpan.innerText = emoji;
      if (this.#onActivate) this.#updateLabel();
    }
  }

  dispose() {
    if (this.#onActivate) this.container?.removeEventListener("click", this.#onActivate);
    this.#onActivate = null;
    this.#speedSpan = null;
    this.container?.remove();
    this.container = null;
    this.emojiSpan = null;
    this.timeSpan = null;
  }
}
