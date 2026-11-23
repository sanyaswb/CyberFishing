import { ColorValue } from "./color_value.js";
import { TextField } from "./text_field.js";

// TK-320 / TK-348.1 (owner): a colour parameter on the same row as its label — the swatch and editable text input stay
// together beside the label/reset button at the same height as NumberField, wrapping together only when narrow. Clicking
// the swatch opens the overlaid native <input type="color"> (plus inline opacity slider for rgba/#rrggbbaa); clicking the
// swatch a second time closes it while preserving the selected colour.
export class ColorField {
  #root;
  #swatch;
  #text;
  #picker;
  #colorInput;
  #alphaRow;
  #alphaInput;
  #alphaValue;
  #color;
  #onCommit;
  #scheduler;
  #nativeOpen = false;
  #suppressNextOpen = false;
  #focusTimer = null;
  #disposers = [];

  constructor({ value, onCommit, ariaLabel = "", documentRef = document,
    scheduler = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) } }) {
    this.#onCommit = onCommit;
    this.#scheduler = scheduler;
    this.#root = documentRef.createElement("div");
    this.#root.className = "devtools__color";

    const controls = documentRef.createElement("span");
    controls.className = "devtools__color-controls";

    const chip = documentRef.createElement("span");
    chip.className = "devtools__color-chip";
    this.#swatch = documentRef.createElement("span");
    this.#swatch.className = "devtools__color-swatch";
    this.#swatch.setAttribute("aria-hidden", "true");

    this.#colorInput = documentRef.createElement("input");
    this.#colorInput.type = "color";
    this.#colorInput.className = "devtools__color-input";
    this.#colorInput.setAttribute("aria-label", `Вибрати колір${ariaLabel ? `: ${ariaLabel}` : ""}`);
    this.#colorInput.setAttribute("aria-expanded", "false");
    chip.append(this.#swatch, this.#colorInput);

    this.#text = new TextField({ value, ariaLabel, documentRef, onCommit: (text) => {
      this.#show(text);
      this.#onCommit?.(text);
    } });
    controls.append(chip, this.#text.element);

    this.#picker = documentRef.createElement("div");
    this.#picker.className = "devtools__color-picker";
    this.#picker.hidden = true;
    this.#alphaRow = documentRef.createElement("label");
    this.#alphaRow.className = "devtools__color-alpha";
    const alphaName = documentRef.createElement("span");
    alphaName.textContent = "Непрозорість";
    this.#alphaInput = documentRef.createElement("input");
    this.#alphaInput.type = "range";
    this.#alphaInput.min = "0";
    this.#alphaInput.max = "1";
    this.#alphaInput.step = "0.01";
    this.#alphaInput.className = "devtools__color-alpha-input";
    this.#alphaInput.setAttribute("aria-label", "Непрозорість");
    this.#alphaValue = documentRef.createElement("span");
    this.#alphaValue.className = "devtools__color-alpha-value";
    this.#alphaRow.append(alphaName, this.#alphaInput, this.#alphaValue);
    this.#picker.append(this.#alphaRow);

    this.#root.append(controls, this.#picker);

    this.#listen(this.#colorInput, "pointerdown", () => {
      if (this.#nativeOpen || !this.#picker.hidden) this.#suppressNextOpen = true;
    });
    this.#listen(this.#colorInput, "click", (event) => {
      const shouldClose = this.#suppressNextOpen || this.#nativeOpen || !this.#picker.hidden;
      this.#suppressNextOpen = false;
      if (shouldClose) {
        event.preventDefault();
        this.#clearFocusTimer();
        this.#setExpanded(false);
        return;
      }
      this.#nativeOpen = true;
      if (!this.#alphaRow.hidden) this.#picker.hidden = false;
      this.#colorInput.setAttribute("aria-expanded", "true");
    });
    this.#listen(this.#colorInput, "change", () => this.#closeNative());
    this.#listen(this.#colorInput, "cancel", () => this.#closeNative());
    if (typeof window !== "undefined" && window?.addEventListener) {
      const onWindowFocus = () => {
        if (!this.#nativeOpen || this.#suppressNextOpen) return;
        this.#clearFocusTimer();
        this.#focusTimer = this.#scheduler.setTimeout(() => {
          this.#focusTimer = null;
          this.#closeNative();
        }, 120);
      };
      window.addEventListener("focus", onWindowFocus);
      this.#disposers.push(() => window.removeEventListener("focus", onWindowFocus));
    }
    this.#listen(this.#colorInput, "input", () => {
      const picked = ColorValue.parse(this.#colorInput.value);
      if (picked && this.#color) this.#write({ ...this.#color, r: picked.r, g: picked.g, b: picked.b });
    });
    this.#listen(this.#alphaInput, "input", () => {
      if (this.#color) this.#write({ ...this.#color, a: Number(this.#alphaInput.value) });
    });
    this.#show(value);
  }

  get element() {
    return this.#root;
  }

  setValue(value) {
    this.#text.setValue(value);
    this.#show(value);
  }

  dispose() {
    this.#clearFocusTimer();
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#text.dispose();
    this.#onCommit = null;
  }

  #closeNative() {
    this.#nativeOpen = false;
    if (this.#picker.hidden) this.#colorInput.setAttribute("aria-expanded", "false");
  }

  #setExpanded(open) {
    this.#nativeOpen = open;
    this.#picker.hidden = !open || this.#alphaRow.hidden;
    this.#colorInput.setAttribute("aria-expanded", String(open));
  }

  #clearFocusTimer() {
    if (this.#focusTimer !== null) this.#scheduler.clearTimeout(this.#focusTimer);
    this.#focusTimer = null;
  }

  #write(color) {
    const text = ColorValue.format(color);
    this.#text.setValue(text);
    this.#show(text);
    this.#onCommit?.(text);
  }

  // The swatch, the native colour input and the opacity slider follow the value (a typed or synced one too).
  #show(value) {
    this.#color = ColorValue.parse(value);
    this.#swatch.style.setProperty("--devtools-color-value", this.#color ? String(value).trim() : "transparent");
    if (!this.#color) {
      this.#alphaRow.hidden = true;
      this.#picker.hidden = true;
      return;
    }
    this.#colorInput.value = ColorValue.toHex6(this.#color);
    const hasAlpha = this.#color.format === "rgba" || this.#color.format === "hex8";
    this.#alphaRow.hidden = !hasAlpha;
    if (!hasAlpha) this.#picker.hidden = true;
    this.#alphaInput.value = String(this.#color.a);
    this.#alphaValue.textContent = `${Math.round(this.#color.a * 100)}%`;
  }

  #listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.#disposers.push(() => target.removeEventListener(type, listener));
  }
}
