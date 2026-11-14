// DEV slider with its value beside it (spec 174 B1; spec 129 Revision 2: grid and depth opacity). onInput(value)
// receives the whole number while the slider moves.
export class RangeField {
  #root;
  #range;
  #output;
  #onInput;
  #disposers = [];

  constructor({ value, onInput, min = 0, max = 100, step = 1, ariaLabel = "", documentRef = document }) {
    this.#onInput = onInput;
    this.#root = documentRef.createElement("span");
    this.#root.className = "devtools__range-field";
    this.#range = documentRef.createElement("input");
    this.#range.type = "range";
    this.#range.min = String(min);
    this.#range.max = String(max);
    this.#range.step = String(step);
    this.#range.className = "devtools__range";
    if (ariaLabel) this.#range.setAttribute("aria-label", ariaLabel);
    this.#output = documentRef.createElement("span");
    this.#output.className = "devtools__range-value";
    this.#root.append(this.#range, this.#output);
    this.setValue(value);
    const onRangeInput = (event) => {
      const next = Number(event.target.value);
      this.#output.textContent = String(next);
      this.#onInput?.(next);
    };
    this.#range.addEventListener("input", onRangeInput);
    this.#disposers.push(() => this.#range.removeEventListener("input", onRangeInput));
  }

  get element() {
    return this.#root;
  }

  setValue(value) {
    const shown = String(Math.round(value));
    this.#range.value = shown;
    this.#output.textContent = shown;
  }

  dispose() {
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#onInput = null;
  }
}
