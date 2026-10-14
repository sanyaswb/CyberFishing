export class UiCatalogControlsExample {
  #dom;
  #closeRenderer;
  #switchRenderer;
  #mount;
  #status;
  #close = null;
  #switch = null;
  constructor({ domFactory, closeButtonRenderer, autoSwitchRenderer, surface, status }) {
    this.#dom = domFactory; this.#closeRenderer = closeButtonRenderer;
    this.#switchRenderer = autoSwitchRenderer; this.#mount = surface.mountRoot; this.#status = status;
    this.#mount.classList.add("ui-catalog-preview__control-layout");
  }
  setState(state) {
    this.#clear();
    const disabled = state === "disabled";
    this.#close = this.#closeRenderer.create({ label: state === "long" ? "Закрити контрольний приклад із дуже довгою доступною назвою" : "Закрити приклад", disabled,
      onClose: () => { this.#status.textContent = "Натиснуто спільну кнопку закриття."; } });
    this.#switch = this.#switchRenderer.create({ id: "catalog-auto-mode", name: "Наживка", modeLabel: "Автонаживляння", disabled,
      placeholderUrl: "assets/ui/inventory/bait.svg", items: state === "empty" ? [] : [{ name: "Контрольна наживка", iconUrl: "assets/ui/inventory/bait.svg" }],
      checked: state === "enabled", stock: state === "empty" ? 0 : 12,
      onChange: (checked) => { this.#status.textContent = checked ? "Автоматичний режим увімкнено у прикладі." : "Автоматичний режим вимкнено у прикладі."; } });
    this.#mount.append(this.#close, this.#switch);
  }
  dispose() { this.#clear(); }
  #clear() {
    if (this.#close) { this.#closeRenderer.dispose(this.#close); this.#close.remove(); }
    if (this.#switch) { this.#switchRenderer.dispose(this.#switch); this.#switch.remove(); }
    this.#close = null; this.#switch = null;
  }
}
