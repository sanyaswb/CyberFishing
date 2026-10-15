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
    this.#status.textContent = state === "error" ? "Будь-яка дія показує production warning. Дані гри не змінюються." : "Числові значення та дії належать лише цьому прикладу.";
    this.#surface.measure();
  }
  setValue(value) { this.#fixture.setValue(value); this.#ui.updateDynamicProgression(250); }
  dispose() { this.#ui.dispose(); this.#scope.dispose(); }
}
