const TONES = Object.freeze(["info", "warning", "error"]);

// One transient hint (spec 080): message text and a close button. Appearance and tones belong to the shared
// `ui-hint` block; the owner places the hint inside its own container through a BEM mix (`className`).
export class UiHintRenderer {
  #dom;
  #parts = new WeakMap();
  #sheet;
  #visible = null;

  constructor({ domFactory, sheetController = null }) {
    this.#dom = domFactory;
    this.#sheet = sheetController;
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
  adopt(hint, { text, close, tone = "info", onClose = null, onLayoutChange = null }) {
    const activate = () => {
      this.hide(hint);
      onClose?.();
    };
    close.addEventListener("click", activate);
    let handle = null;
    if (this.#sheet) {
      handle = this.#dom.button("ui-sheet-handle ui-hint__handle", "", { title: close.getAttribute("aria-label") });
      handle.hidden = true;
      handle.setAttribute("aria-label", close.getAttribute("aria-label"));
      hint.appendChild(handle);
      handle.addEventListener("click", activate);
      this.#sheet.attach(hint, { text, close, handle, onDismiss: activate, onLayoutChange });
    }
    this.#parts.set(hint, { text, close, handle, activate, tone: null });
    this.#setTone(hint, tone);
    return hint;
  }

  show(hint, message, tone = null) {
    const parts = this.#parts.get(hint);
    if (!parts) return;
    if (this.#visible && this.#visible !== hint) this.hide(this.#visible);
    this.#visible = hint;
    if (parts.text.textContent !== message) parts.text.textContent = message;
    if (tone) this.#setTone(hint, tone);
    hint.hidden = false;
    this.#sheet?.show(hint);
  }

  hide(hint) {
    this.#sheet?.hide(hint);
    if (hint && !hint.hidden) hint.hidden = true;
    if (this.#visible === hint) this.#visible = null;
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
    this.hide(hint);
    parts.close.removeEventListener("click", parts.activate);
    parts.handle?.removeEventListener("click", parts.activate);
    parts.handle?.remove();
    this.#sheet?.dispose(hint);
    if (this.#visible === hint) this.#visible = null;
    this.#parts.delete(hint);
  }

  #setTone(hint, tone) {
    const parts = this.#parts.get(hint);
    const next = TONES.includes(tone) ? tone : "info";
    if (parts.tone === next) return;
    for (const candidate of TONES) if (candidate !== next) hint.classList.remove(`ui-hint--${candidate}`);
    hint.classList.add(`ui-hint--${next}`);
    parts.tone = next;
  }
}
