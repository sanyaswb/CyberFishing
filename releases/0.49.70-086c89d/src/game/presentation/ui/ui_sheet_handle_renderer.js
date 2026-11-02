export class UiSheetHandleRenderer {
  #dom;
  #dismiss;

  constructor({ domFactory, dismissController }) {
    this.#dom = domFactory;
    this.#dismiss = dismissController;
  }

  create({ label, onDismiss, onDrag, onDragStart, onExpand, onTap, className = "" }) {
    const handle = this.#dom.button(`ui-sheet-handle ${className}`.trim(), "", { title: label });
    handle.setAttribute("aria-label", label);
    this.#dismiss.attach(handle, { onDismiss, onDrag, onDragStart, onExpand, onTap });
    return handle;
  }

  dispose(handle) { this.#dismiss.detach(handle); }
}
