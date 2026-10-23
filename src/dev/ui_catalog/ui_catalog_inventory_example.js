export class UiCatalogInventoryExample {
  #fixture;
  #ui;
  #scope;
  #surface;
  #status;
  constructor({ fixture, ui, documentScope, surface, status }) {
    this.#fixture = fixture; this.#ui = ui; this.#scope = documentScope;
    this.#surface = surface; this.#status = status;
    ui.mount();
    ui.rootNode.classList.add("ui-catalog-preview__overlay");
    ui.rootNode.setAttribute("aria-modal", "false");
    for (const button of surface.mountRoot.querySelectorAll(".inventory-backpack-button")) button.classList.add("ui-catalog-preview__toolbar");
    ui.open();
  }
  setState(state) {
    this.#fixture.reset(state);
    this.#ui.open();
    this.#ui.refresh();
    if (state === "long") this.#ui.showWarning("Довге попередження інвентаря. Текст можна прокручувати, а шторку закрити рухом униз. ".repeat(30));
    this.#status.textContent = "";
    this.#surface.measure();
  }
  setValue(value) { this.#fixture.setValue(value); this.#ui.updateDynamicProgression(250); }
  dispose() { this.#ui.dispose(); this.#scope.dispose(); }
}
