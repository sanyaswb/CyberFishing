// DEV on/off switch (spec 174 B1): a native checkbox drawn as a slider, so the keyboard and assistive technology get
// a real checkbox. onCommit(next) may refuse a change by returning false: the switch then shows its previous value.
export class SwitchControl {
  #root;
  #input;
  #value;
  #onCommit;
  #disposers = [];

  constructor({ value, onCommit, ariaLabel = "", documentRef = document }) {
    this.#value = value === true;
    this.#onCommit = onCommit;
    this.#root = documentRef.createElement("label");
    this.#root.className = "devtools__switch";
    this.#input = documentRef.createElement("input");
    this.#input.className = "devtools__switch-input";
    this.#input.type = "checkbox";
    if (ariaLabel) this.#input.setAttribute("aria-label", ariaLabel);
    this.#input.checked = this.#value;
    const slider = documentRef.createElement("span");
    slider.className = "devtools__slider";
    this.#root.append(this.#input, slider);
    const onChange = (event) => {
      const next = event.target.checked;
      if (this.#onCommit?.(next) === false) {
        this.#input.checked = this.#value;
        return;
      }
      this.#value = next;
    };
    this.#input.addEventListener("change", onChange);
    this.#disposers.push(() => this.#input.removeEventListener("change", onChange));
  }

  get element() {
    return this.#root;
  }

  get value() {
    return this.#value;
  }

  setValue(value) {
    this.#value = value === true;
    this.#input.checked = this.#value;
  }

  // Shown as blocked (a prerequisite is off): the switch stays focusable so the attempt can be explained.
  setBlocked(blocked) {
    this.#input.setAttribute("aria-disabled", String(blocked));
  }

  dispose() {
    for (const dispose of this.#disposers) dispose();
    this.#disposers.length = 0;
    this.#onCommit = null;
  }
}
