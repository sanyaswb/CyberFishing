// DEV segmented switch (spec 174 A3, TK-283): every option of a short list is visible and one press selects it.
// options: [{ value, label }]; onCommit(value) is called only when the selection changes.
export class SegmentedControl {
  #root;
  #buttons = [];
  #options;
  #value;
  #onCommit;
  #disposers = [];

  constructor({ options, value, onCommit, ariaLabel = "", documentRef = document }) {
    this.#options = options;
    this.#value = value;
    this.#onCommit = onCommit;
    this.#root = documentRef.createElement("div");
    this.#root.className = "devtools__segments";
    this.#root.setAttribute("role", "radiogroup");
    if (ariaLabel) this.#root.setAttribute("aria-label", ariaLabel);
    options.forEach((option, index) => {
      const button = documentRef.createElement("button");
      button.type = "button";
      button.className = "devtools__segment";
      button.setAttribute("role", "radio");
      button.textContent = option.label;
      this.#listen(button, "click", () => this.#select(index));
      // The radio group's keys: the arrows move the selection.
      this.#listen(button, "keydown", (event) => {
        const move = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!move) return;
        event.preventDefault();
        event.stopPropagation(); // the game's arrows (drag, rod) stay untouched
        const next = (index + move + options.length) % options.length;
        this.#select(next);
        this.#buttons[next].focus?.();
      });
      this.#buttons.push(button);
      this.#root.appendChild(button);
    });
    this.#show();
  }

  get element() {
    return this.#root;
  }

  setValue(value) {
    this.#value = value;
    this.#show();
  }

  dispose() {
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#onCommit = null;
  }

  #select(index) {
    const next = this.#options[index].value;
    if (next === this.#value) return;
    this.#value = next;
    this.#show();
    this.#onCommit?.(next);
  }

  #show() {
    const selected = this.#options.findIndex((option) => option.value === this.#value);
    this.#buttons.forEach((button, index) => {
      const isSelected = index === selected;
      button.classList.toggle("devtools__segment--selected", isSelected);
      button.setAttribute("aria-checked", String(isSelected));
      // One tab stop for the group: the selected option, or the first when the value is not among the options.
      button.tabIndex = isSelected || (selected < 0 && index === 0) ? 0 : -1;
    });
  }

  #listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.#disposers.push(() => target.removeEventListener(type, listener));
  }
}
