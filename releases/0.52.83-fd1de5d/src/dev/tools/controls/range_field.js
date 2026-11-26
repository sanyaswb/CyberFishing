// DEV slider with its value beside it (spec 174 B1; spec 129 Revision 2: grid and depth opacity). onInput(value)
// receives the whole number while the slider moves.
const INPUT_HOLD_MS = 1000;

export class RangeField {
  #root;
  #range;
  #output;
  #onInput;
  #decimals = 0;
  #disposers = [];
  // TK-401: when the person last moved the slider (ms of `now`); a value from outside does not move it for INPUT_HOLD_MS
  // after that, so a live value never pulls the thumb from under the finger.
  #lastInputAt = -Infinity;
  #now;

  constructor({ value, onInput, min = 0, max = 100, step = 1, ariaLabel = "", documentRef = document, now = () => Date.now() }) {
    this.#onInput = onInput;
    this.#now = now;
    // Spec 180 D16: a fractional step shows its decimals (0.01 → 2), so a real value reads as itself.
    const stepText = String(step);
    this.#decimals = stepText.includes(".") ? Math.min(4, stepText.split(".")[1].length) : 0;
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
      this.#lastInputAt = this.#now();
      const next = Number(event.target.value);
      this.#output.textContent = next.toFixed(this.#decimals);
      this.#onInput?.(next);
    };
    this.#range.addEventListener("input", onRangeInput);
    this.#disposers.push(() => this.#range.removeEventListener("input", onRangeInput));
  }

  get element() {
    return this.#root;
  }

  setValue(value) {
    if (this.#now() - this.#lastInputAt < INPUT_HOLD_MS) return;
    const shown = (Number(value) || 0).toFixed(this.#decimals);
    this.#range.value = shown;
    this.#output.textContent = shown;
  }

  // Spec 187 D11: a refused move (an unmet prerequisite) puts the value back at once, the person's move notwithstanding.
  resetValue(value) {
    this.#lastInputAt = -Infinity;
    this.setValue(value);
  }

  dispose() {
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#onInput = null;
  }
}
