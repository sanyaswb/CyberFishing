import { addSteps, decimalsOf, parseDecimal, stepOfDecimals } from "./decimal_step.js";

const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 60;
const MIN_CHARS = 4;
const MAX_CHARS = 14;

// DEV number field (spec 174 A2, TK-282): [ − | text | + ].
// - The step follows the finest precision the field has shown or received (0.1 -> 0.1, 0.25 -> 0.01, 40 -> 1) and never
//   gets coarser while the field lives, so 0.9 -> 1 -> 1.1. Shift: ten steps. Alt: a tenth of a step.
// - Arrow up/down step; left/right, Home and End stay the caret's. Enter writes, Escape restores the written value.
// - Text that is not a number is never written: the field shows an error and restores the value when it loses focus.
// - A held − / + repeats. onCommit(number) is called only when the number changes.
export class NumberField {
  #root;
  #input;
  #buttons = [];
  #value;
  #decimals;
  #onCommit;
  #scheduler;
  #holdTimer = null;
  #pointerStepped = false;
  #disposers = [];

  constructor({ value, onCommit, ariaLabel = "", documentRef = document,
    scheduler = { setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: (id) => clearTimeout(id) } }) {
    this.#value = Number(value) || 0;
    this.#decimals = decimalsOf(this.#value);
    this.#onCommit = onCommit;
    this.#scheduler = scheduler;

    this.#root = documentRef.createElement("span");
    this.#root.className = "devtools__number";
    this.#input = documentRef.createElement("input");
    this.#input.type = "text";
    this.#input.inputMode = "decimal";
    this.#input.autocomplete = "off";
    this.#input.spellcheck = false;
    this.#input.className = "devtools__input devtools__input--number";
    if (ariaLabel) this.#input.setAttribute("aria-label", ariaLabel);
    this.#root.append(this.#createStepButton(documentRef, -1, "Зменшити"), this.#input,
      this.#createStepButton(documentRef, 1, "Збільшити"));
    this.#showValue();

    this.#listen(this.#input, "keydown", (event) => this.#onKeyDown(event));
    this.#listen(this.#input, "input", () => { this.#setError(false); this.#fitWidth(); });
    this.#listen(this.#input, "focus", () => this.#input.select?.());
    this.#listen(this.#input, "blur", () => { if (!this.#commitText()) this.#showValue(); });
  }

  get element() {
    return this.#root;
  }

  // The value from outside (another control, an import, a reset): shown as it is, never written back.
  setValue(value) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    this.#value = next;
    this.#decimals = Math.max(this.#decimals, decimalsOf(next));
    this.#showValue();
  }

  dispose() {
    this.#stopHold();
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#onCommit = null;
  }

  #createStepButton(documentRef, direction, label) {
    const button = documentRef.createElement("button");
    button.type = "button";
    button.tabIndex = -1; // the arrow keys step from the field; the buttons serve the pointer
    button.className = direction < 0 ? "devtools__number-step devtools__number-step--down"
      : "devtools__number-step devtools__number-step--up";
    button.setAttribute("aria-label", label);
    this.#listen(button, "pointerdown", (event) => {
      if (event.button > 0) return;
      this.#pointerStepped = true;
      button.setPointerCapture?.(event.pointerId);
      this.#step(direction, event);
      this.#stopHold();
      const repeat = () => {
        if (this.#input.isConnected === false) return this.#stopHold();
        this.#step(direction, event);
        this.#holdTimer = this.#scheduler.setTimeout(repeat, HOLD_REPEAT_MS);
      };
      this.#holdTimer = this.#scheduler.setTimeout(repeat, HOLD_DELAY_MS);
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) this.#listen(button, type, () => this.#stopHold());
    // A click without a pointer press (keyboard, assistive technology) is one step.
    this.#listen(button, "click", (event) => {
      if (this.#pointerStepped) this.#pointerStepped = false;
      else this.#step(direction, event);
    });
    this.#buttons.push(button);
    return button;
  }

  #onKeyDown(event) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      this.#step(event.key === "ArrowUp" ? 1 : -1, event);
    } else if (event.key === "Enter") {
      this.#commitText();
    } else if (event.key === "Escape") {
      this.#showValue();
    }
  }

  // Steps from the typed number when there is one, otherwise from the written value.
  #step(direction, modifiers) {
    const typed = parseDecimal(this.#input.value);
    if (typed !== null) this.#decimals = Math.max(this.#decimals, decimalsOf(typed));
    let step = stepOfDecimals(this.#decimals);
    if (modifiers?.altKey) step = stepOfDecimals(this.#decimals + 1);
    const count = direction * (modifiers?.shiftKey ? 10 : 1);
    this.#write(addSteps(typed ?? this.#value, step, count));
  }

  // true when the text is a number (written if it changed); false leaves the error on the field.
  #commitText() {
    const typed = parseDecimal(this.#input.value);
    if (typed === null) {
      this.#setError(true);
      return false;
    }
    this.#write(typed);
    return true;
  }

  #write(next) {
    this.#decimals = Math.max(this.#decimals, decimalsOf(next));
    const changed = next !== this.#value;
    this.#value = next;
    this.#showValue();
    if (changed) this.#onCommit?.(next);
  }

  #showValue() {
    this.#input.value = String(this.#value);
    this.#setError(false);
    this.#fitWidth();
  }

  #setError(isError) {
    this.#root.classList.toggle("devtools__number--error", isError);
    if (isError) this.#input.setAttribute("aria-invalid", "true");
    else this.#input.removeAttribute("aria-invalid");
  }

  // The whole number stays visible: the field is as wide as its text, within limits.
  #fitWidth() {
    const chars = Math.min(MAX_CHARS, Math.max(MIN_CHARS, String(this.#input.value).length));
    this.#root.style.setProperty("--devtools-number-chars", String(chars));
  }

  #stopHold() {
    if (this.#holdTimer !== null) this.#scheduler.clearTimeout(this.#holdTimer);
    this.#holdTimer = null;
  }

  #listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.#disposers.push(() => target.removeEventListener(type, listener));
  }
}
