import { NumberField } from "./number_field.js";

// TK-347: a two-number range/pair ([from, to], [at 0, at 100]) composed from two NumberField controls so each bound
// keeps its own − / + buttons, decimal step precision, keyboard stepping, hold-to-repeat and invalid-input protection.
export class NumberPairField {
  #root;
  #values;
  #fromField;
  #toField;
  #onCommit;

  constructor({ value, onCommit, ariaLabel = "", documentRef = document, scheduler }) {
    this.#onCommit = onCommit;
    const [fromValue, toValue] = Array.isArray(value) && value.length >= 2
      ? [Number(value[0]) || 0, Number(value[1]) || 0]
      : [0, 0];
    this.#values = [fromValue, toValue];

    this.#root = documentRef.createElement("span");
    this.#root.className = "devtools__number-pair";

    this.#fromField = new NumberField({
      value: fromValue,
      ariaLabel: ariaLabel ? `${ariaLabel}: від` : "Від",
      documentRef,
      scheduler,
      onCommit: (nextFrom) => this.#commitAt(0, nextFrom),
    });

    const separator = documentRef.createElement("span");
    separator.className = "devtools__number-pair-separator";
    separator.textContent = "–";
    separator.setAttribute("aria-hidden", "true");

    this.#toField = new NumberField({
      value: toValue,
      ariaLabel: ariaLabel ? `${ariaLabel}: до` : "До",
      documentRef,
      scheduler,
      onCommit: (nextTo) => this.#commitAt(1, nextTo),
    });

    this.#root.append(this.#fromField.element, separator, this.#toField.element);
  }

  get element() {
    return this.#root;
  }

  setValue(value) {
    if (!Array.isArray(value) || value.length < 2) return;
    const nextFrom = Number(value[0]);
    const nextTo = Number(value[1]);
    if (!Number.isFinite(nextFrom) || !Number.isFinite(nextTo)) return;
    this.#values = [nextFrom, nextTo];
    this.#fromField.setValue(nextFrom);
    this.#toField.setValue(nextTo);
  }

  dispose() {
    this.#fromField.dispose();
    this.#toField.dispose();
    this.#onCommit = null;
  }

  #commitAt(index, nextValue) {
    const next = [...this.#values];
    next[index] = nextValue;
    this.#values = next;
    this.#onCommit?.([...next]);
  }
}
