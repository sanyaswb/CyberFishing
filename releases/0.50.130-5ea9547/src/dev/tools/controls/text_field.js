// DEV text field (spec 174 B1): a value written when the field is left or Enter is pressed (the browser's change).
// format(value) -> the shown text; parse(text) -> the value written. The number list ("1, 2, 3") is TextField.numberList.
export class TextField {
  #input;
  #format;
  #parse;
  #onCommit;
  #disposers = [];

  constructor({ value, onCommit, ariaLabel = "", format = (shown) => String(shown ?? ""), parse = (text) => text,
    documentRef = document }) {
    this.#format = format;
    this.#parse = parse;
    this.#onCommit = onCommit;
    this.#input = documentRef.createElement("input");
    this.#input.type = "text";
    this.#input.className = "devtools__input devtools__input--text";
    if (ariaLabel) this.#input.setAttribute("aria-label", ariaLabel);
    this.#input.value = format(value);
    const onChange = (event) => this.#onCommit?.(this.#parse(event.target.value));
    this.#input.addEventListener("change", onChange);
    this.#disposers.push(() => this.#input.removeEventListener("change", onChange));
  }

  // Numbers separated by commas, spaces or semicolons; a part that is not a number is 0 (as before spec 174).
  static numberList(options) {
    return new TextField({ ...options,
      format: (value) => (Array.isArray(value) ? value.join(", ") : String(value ?? "")),
      parse: (text) => text.trim().split(/[\s,;]+/).filter(Boolean).map((part) => parseFloat(part) || 0) });
  }

  get element() {
    return this.#input;
  }

  setValue(value) {
    this.#input.value = this.#format(value);
  }

  dispose() {
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#onCommit = null;
  }
}
