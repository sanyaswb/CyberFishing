export class UiCatalogKeepnetExample {
  #fixture;
  #ui;
  #scope;
  #surface;
  #status;
  constructor({ fixture, ui, documentScope, surface, status }) {
    this.#fixture = fixture; this.#ui = ui; this.#scope = documentScope;
    this.#surface = surface; this.#status = status;
    documentScope.querySelector(".keepnet-modal").classList.add("ui-catalog-preview__overlay");
    documentScope.querySelector(".keepnet-modal").setAttribute("aria-modal", "false");
    documentScope.querySelector(".keepnet-button").classList.add("ui-catalog-preview__toolbar");
    ui.open();
  }
  setState(state) {
    this.#fixture.reset(state);
    this.#ui.close(); this.#ui.open();
    const image = this.#scope.querySelector(".keepnet-modal__icon");
    const illustrations = { portrait: "assets/ui/inventory/rod.svg", wide: "assets/house/room-1/room--1_aqua.png", square: "assets/ui/inventory/keepnet.svg" };
    image.src = illustrations[state] || "assets/ui/inventory/keepnet.svg";
    this.#status.textContent = "Відкрийте вид риби, натисніть «Відпустити» для підтвердження. Escape закриває підказку, підтвердження, деталі, потім вікно.";
    this.#surface.measure();
  }
  setValue(value) { this.#fixture.setValue(value); this.#ui.refresh(); }
  dispose() { this.#ui.dispose(); this.#scope.dispose(); }
}
