import { UiEventShield } from "../dom/ui_event_shield.js";

const SVG = "http://www.w3.org/2000/svg";
const COUNTER_MS = 1000;
// Five cracks in the circle's 40 × 40 box, from the rim inward; stage N shows the first N (the 5th runs across it).
const CRACKS = Object.freeze([
  "M8 9 L14 14 L13 19",
  "M33 8 L27 14 L29 19 L25 22",
  "M5 27 L12 24 L17 27",
  "M35 30 L28 26 L25 30 L21 28",
  "M20 2 L19 10 L22 15 L18 21 L21 28 L19 38",
]);

// Spec 185 D6 (TK-384, owner: «поки це буде просто індикатор іконка протигаза аналогічно до горілки»): the gas mask's
// round indicator in the HUD column, after the radio — shown while a gas mask is worn. Its fill is the mask's condition
// (the level from the bottom, the degradation colour), the cracks of its stage lie over it (80 / 60 / 40 / 20 / 0 %, the
// last ones thicker), and it fades when the mask does not protect (no filter with time left, or cracked). A tap shows
// the filters' time left (m:ss), rewritten once a second while open. The DOM is written only on change: on the
// inventory's events (the condition is written every few seconds, a filter changes) and by the open counter's timer.
// A Spine effect of the cracked glass replaces the cracks later (owner).
export class GasMaskHudIndicator {
  #button;
  #fill;
  #count;
  #reader;
  #labels;
  #levelColor;
  #scheduler;
  #unsubscribe;
  #counterTimer = null;
  #counting = false;
  #shown = null;
  #stage = null;
  #level = null;
  #protecting = null;
  #title = null;

  // reader: () => GasMaskProtection.read(); subscribe(handler) → unsubscribe (inventory changes); icons: the HUD icon
  // port ({ create(symbol, className) }); labels: STATUS_LABELS; levelColor: (percent) => a CSS colour; scheduler:
  // { setInterval, clearInterval } (the window).
  constructor({ documentRef, mountNode, reader, subscribe, icons, labels, levelColor, scheduler }) {
    if (typeof reader !== "function") throw new TypeError("GasMaskHudIndicator requires reader");
    if (typeof subscribe !== "function") throw new TypeError("GasMaskHudIndicator requires subscribe");
    this.#reader = reader;
    this.#labels = labels;
    this.#levelColor = levelColor;
    this.#scheduler = scheduler;
    const button = documentRef.createElement("button");
    button.type = "button";
    button.className = "hud-indicator hud-indicator--status hud-indicator--gas-mask";
    button.hidden = true;
    UiEventShield.makeSolid(button);
    const fill = documentRef.createElement("span");
    fill.className = "hud-indicator__fill hud-indicator__fill--level";
    const icon = icons.create("gas-mask", "hud-indicator__icon");
    const cracks = documentRef.createElementNS(SVG, "svg");
    cracks.setAttribute("viewBox", "0 0 40 40");
    cracks.setAttribute("aria-hidden", "true");
    cracks.setAttribute("class", "hud-indicator__cracks");
    for (const d of CRACKS) {
      const crack = documentRef.createElementNS(SVG, "path");
      crack.setAttribute("class", "hud-indicator__crack");
      crack.setAttribute("d", d);
      cracks.append(crack);
    }
    const count = documentRef.createElement("span");
    count.className = "hud-indicator__count";
    count.hidden = true;
    button.append(fill);
    if (icon) button.append(icon);
    button.append(cracks, count);
    button.addEventListener("click", () => this.#toggleCounter());
    mountNode.appendChild(button);
    this.#button = button;
    this.#fill = fill;
    this.#count = count;
    this.#unsubscribe = subscribe(() => this.refresh());
    this.refresh();
  }

  refresh() {
    if (!this.#button) return;
    const reading = this.#reader();
    if (reading.worn !== this.#shown) {
      this.#shown = reading.worn;
      this.#button.hidden = !reading.worn;
      if (!reading.worn) this.#stopCounter();
    }
    if (!reading.worn) return;
    if (reading.stage !== this.#stage) {
      if (this.#stage) this.#button.classList.remove(`hud-indicator--cracks-${this.#stage}`);
      if (reading.stage) this.#button.classList.add(`hud-indicator--cracks-${reading.stage}`);
      this.#stage = reading.stage;
    }
    const level = Math.round(reading.condition);
    if (level !== this.#level) {
      this.#level = level;
      this.#fill.style.setProperty("--hud-indicator-level", String(level / 100));
      this.#fill.style.setProperty("--hud-indicator-color-full", this.#levelColor(level));
    }
    if (reading.protecting !== this.#protecting) {
      this.#protecting = reading.protecting;
      this.#button.classList.toggle("hud-indicator--unprotected", !reading.protecting);
    }
    const title = this.#labels.gasMask(reading.condition, reading.protecting);
    if (title !== this.#title) {
      this.#title = title;
      this.#button.title = title;
      this.#button.setAttribute("aria-label", title);
    }
    if (this.#counting) this.#writeCount(reading.filterSec);
  }

  dispose() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#stopCounter();
    this.#button?.remove();
    this.#button = null;
  }

  #toggleCounter() {
    if (this.#counting) {
      this.#stopCounter();
      return;
    }
    this.#counting = true;
    this.#count.hidden = false;
    this.#writeCount(this.#reader().filterSec);
    this.#counterTimer = this.#scheduler.setInterval(() => this.#writeCount(this.#reader().filterSec), COUNTER_MS);
  }

  #writeCount(seconds) {
    const text = this.#labels.countdown(seconds);
    if (this.#count.textContent !== text) this.#count.textContent = text;
  }

  #stopCounter() {
    this.#counting = false;
    if (this.#count) this.#count.hidden = true;
    if (this.#counterTimer !== null) this.#scheduler.clearInterval(this.#counterTimer);
    this.#counterTimer = null;
  }
}
