class OverlayScaleControls {
  #documentTarget;
  #onScaleChanged;
  #scale = 1;

  constructor({ documentTarget = document, onScaleChanged = null } = {}) {
    this.#documentTarget = documentTarget;
    this.#onScaleChanged = onScaleChanged;
  }

  create() {
    const controls = this.#documentTarget.createElement("div");
    controls.style.cssText = `
      position: absolute; bottom: 10px; left: 50%;
      transform: translateX(-50%); display: flex; gap: 15px;
      z-index: 10001; pointer-events: all;
    `;

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
    Object.assign(button.style, {
      width: "32px",
      height: "32px",
      backgroundColor: "rgba(0, 204, 255, 0.1)",
      color: "#00ccff",
      border: "1px solid #00ccff",
      borderRadius: "6px",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: "20px",
      cursor: "pointer",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      touchAction: "none",
    });
    return button;
  }

  #bindButton(button, delta) {
    button.addEventListener(
      "pointerdown",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.#scale = Math.max(0.3, Math.min(3.0, this.#scale + delta));
        this.#onScaleChanged?.(this.#scale);
      },
      { capture: true },
    );
  }
}

window.OverlayScaleControls = OverlayScaleControls;
