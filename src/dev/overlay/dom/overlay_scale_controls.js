// The overlay's − / + buttons: steps of 0.1 on a tenths grid, so a start between tenths (2/3) returns to 1.
export class OverlayScaleControls {
  #documentTarget;
  #onScaleChanged;
  #scale;

  constructor({ documentTarget = document, scale = 1, onScaleChanged = null } = {}) {
    this.#documentTarget = documentTarget;
    this.#scale = scale;
    this.#onScaleChanged = onScaleChanged;
  }

  create() {
    const controls = this.#documentTarget.createElement("div");
    controls.className = "debug-overlay__scale-controls";

    const btnMinus = this.#createButton("-");
    const btnPlus = this.#createButton("+");
    this.#bindButton(btnMinus, -0.1);
    this.#bindButton(btnPlus, 0.1);
    controls.append(btnMinus, btnPlus);
    return controls;
  }

  #createButton(label) {
    const button = this.#documentTarget.createElement("button");
    button.innerHTML = label;
    button.className = "debug-overlay__scale-button";
    return button;
  }

  #bindButton(button, delta) {
    button.addEventListener(
      "pointerdown",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.#scale = Math.max(0.3, Math.min(3.0, Math.round((this.#scale + delta) * 10) / 10));
        this.#onScaleChanged?.(this.#scale);
      },
      { capture: true },
    );
  }
}
