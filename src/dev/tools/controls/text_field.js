// DEV text field (spec 174 B1): a value written when the field is left or Enter is pressed (the browser's change).
// format(value) -> the shown text; parse(text) -> the value written. The number list ("1, 2, 3") is TextField.numberList,
// the text list ("Space, KeyS") TextField.stringList, a value that may be null TextField.nullable (spec 180 stage E);
// readOnly shows the value without letting it change (a key the game identifies data by).
export class TextField {
  #input;
  #format;
  #parse;
  #onCommit;
  #disposers = [];

  constructor({ value, onCommit, ariaLabel = "", format = (shown) => String(shown ?? ""), parse = (text) => text,
    readOnly = false, documentRef = document }) {
    this.#format = format;
    this.#parse = parse;
    this.#onCommit = onCommit;
    this.#input = documentRef.createElement("input");
    this.#input.type = "text";
    this.#input.className = "devtools__input devtools__input--text";
    if (ariaLabel) this.#input.setAttribute("aria-label", ariaLabel);
    this.#input.value = format(value);
    if (readOnly) {
      this.#input.readOnly = true;
      this.#input.classList.add("devtools__input--readonly");
      return;
    }
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

  // Texts separated by commas ("Space, KeyS"); an empty field is an empty list.
  static stringList(options) {
    return new TextField({ ...options,
      format: (value) => (Array.isArray(value) ? value.join(", ") : String(value ?? "")),
      parse: (text) => text.split(",").map((part) => part.trim()).filter(Boolean) });
  }

  // A text that may be null: null shows as "null"; "null" or an empty field writes null.
  static nullable(options) {
    return new TextField({ ...options,
      format: (value) => (value === null ? "null" : String(value ?? "")),
      parse: (text) => (text.trim() === "" || text.trim() === "null" ? null : text) });
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
