export class UiCloseButtonRenderer {
  #dom;
  #bindings = new WeakMap();

  constructor({ domFactory }) {
    this.#dom = domFactory;
  }

  create({ label, onClose = null, className = "", disabled = false }) {
    const button = this.#dom.button(`ui-modal-close ${className}`.trim(), "×", {
      title: label, disabled,
    });
    button.setAttribute("aria-label", label);
    const activate = () => onClose?.();
    button.addEventListener("click", activate);
    this.#bindings.set(button, activate);
    return button;
  }

  dispose(button) {
    const activate = this.#bindings.get(button);
    if (activate) button.removeEventListener("click", activate);
    this.#bindings.delete(button);
  }
}
