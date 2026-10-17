const TONES = Object.freeze(["info", "warning", "error"]);

// One transient hint (spec 080): message text and a close button. Appearance and tones belong to the shared
// `ui-hint` block; the owner places the hint inside its own container through a BEM mix (`className`).
export class UiHintRenderer {
  #dom;
  #parts = new WeakMap();

  constructor({ domFactory }) {
    this.#dom = domFactory;
  }

  create({ className = "", closeLabel, tone = "info", role = "status", onClose = null }) {
    const hint = this.#dom.element("div", `ui-hint ${className}`.trim());
    hint.setAttribute("role", role);
    hint.hidden = true;
    const text = this.#dom.element("p", "ui-hint__text");
    const close = this.#dom.button("ui-modal-close ui-hint__close", "×", { title: closeLabel });
    close.setAttribute("aria-label", closeLabel);
    hint.append(text, close);
    return this.adopt(hint, { text, close, tone, onClose });
  }

  // Page markup that already has the ui-hint structure (the House page) gets the same behavior.
  adopt(hint, { text, close, tone = "info", onClose = null }) {
    const activate = () => {
      this.hide(hint);
      onClose?.();
    };
    close.addEventListener("click", activate);
    this.#parts.set(hint, { text, close, activate, tone: null });
    this.#setTone(hint, tone);
    return hint;
  }

  show(hint, message, tone = null) {
    const parts = this.#parts.get(hint);
    if (!parts) return;
    if (parts.text.textContent !== message) parts.text.textContent = message;
    if (tone) this.#setTone(hint, tone);
    hint.hidden = false;
  }

  hide(hint) {
    if (hint && !hint.hidden) hint.hidden = true;
  }

  isVisible(hint) {
    return Boolean(hint) && !hint.hidden;
  }

  textOf(hint) {
    return this.#parts.get(hint)?.text.textContent ?? "";
  }

  dispose(hint) {
    const parts = this.#parts.get(hint);
    if (!parts) return;
    parts.close.removeEventListener("click", parts.activate);
    this.#parts.delete(hint);
  }

  #setTone(hint, tone) {
    const parts = this.#parts.get(hint);
    const next = TONES.includes(tone) ? tone : "info";
    if (parts.tone === next) return;
    if (parts.tone) hint.classList.remove(`ui-hint--${parts.tone}`);
    hint.classList.add(`ui-hint--${next}`);
    parts.tone = next;
  }
}
