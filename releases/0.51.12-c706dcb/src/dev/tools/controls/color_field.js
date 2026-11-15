import { ColorValue } from "./color_value.js";
import { TextField } from "./text_field.js";

// TK-320 (owner): a colour parameter: a swatch of the colour beside its text. The swatch opens a picker under the field:
// the browser's colour input and, for a colour with opacity (rgba, #rrggbbaa), an opacity slider. Every change is
// written at once in the value's own format; the text stays editable for an exact value.
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
  #disposers = [];

  constructor({ value, onCommit, ariaLabel = "", documentRef = document }) {
    this.#onCommit = onCommit;
    this.#root = documentRef.createElement("div");
    this.#root.className = "devtools__color";
    this.#swatch = documentRef.createElement("button");
    this.#swatch.type = "button";
    this.#swatch.className = "devtools__color-swatch";
    this.#swatch.setAttribute("aria-label", `Вибрати колір${ariaLabel ? `: ${ariaLabel}` : ""}`);
    this.#swatch.setAttribute("aria-expanded", "false");
    this.#text = new TextField({ value, ariaLabel, documentRef, onCommit: (text) => {
      this.#show(text);
      this.#onCommit?.(text);
    } });
    this.#picker = documentRef.createElement("div");
    this.#picker.className = "devtools__color-picker";
    this.#picker.hidden = true;
    this.#colorInput = documentRef.createElement("input");
    this.#colorInput.type = "color";
    this.#colorInput.className = "devtools__color-input";
    this.#colorInput.setAttribute("aria-label", "Колір");
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
    this.#picker.append(this.#colorInput, this.#alphaRow);
    this.#root.append(this.#swatch, this.#text.element, this.#picker);

    this.#listen(this.#swatch, "click", () => {
      const open = this.#picker.hidden;
      this.#picker.hidden = !open;
      this.#swatch.setAttribute("aria-expanded", String(open));
    });
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
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#text.dispose();
    this.#onCommit = null;
  }

  #write(color) {
    const text = ColorValue.format(color);
    this.#text.setValue(text);
    this.#show(text);
    this.#onCommit?.(text);
  }

  // The swatch, the picker and the opacity slider follow the value (a typed or synced one too).
  #show(value) {
    this.#color = ColorValue.parse(value);
    this.#swatch.style.setProperty("--devtools-color-value", this.#color ? String(value).trim() : "transparent");
    if (!this.#color) return;
    this.#colorInput.value = ColorValue.toHex6(this.#color);
    const alpha = ColorValue.hasAlpha(this.#color);
    this.#alphaRow.hidden = !alpha;
    this.#alphaInput.value = String(this.#color.a);
    this.#alphaValue.textContent = `${Math.round(this.#color.a * 100)}%`;
  }

  #listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.#disposers.push(() => target.removeEventListener(type, listener));
  }
}
