export class UiCatalogKeepnetExample {
  #fixture;
  #ui;
  #scope;
  #surface;
  #status;
  constructor({ fixture, ui, documentScope, surface, status }) {
    this.#fixture = fixture; this.#ui = ui; this.#scope = documentScope;
    this.#surface = surface; this.#status = status;
    documentScope.querySelector(".keepnet-button").classList.add("ui-catalog-preview__toolbar");
    ui.setVisible(true);
  }
  setState(state) {
    this.#fixture.reset(state);
    this.#ui.setVisible(false); this.#ui.setVisible(true);
    const image = this.#scope.querySelector(".keepnet-section__icon");
    const illustrations = { portrait: "assets/ui/inventory/rod.svg", wide: "assets/house/room-1/room--1_aqua.webp", square: "assets/ui/inventory/keepnet.svg" };
    image.src = illustrations[state] || "assets/ui/inventory/keepnet.svg";
    this.#status.textContent = "Відкрийте вид риби, натисніть «Відпустити» для підтвердження. Escape закриває підказку, підтвердження, потім деталі.";
    this.#surface.measure();
  }
  setValue(value) { this.#fixture.setValue(value); this.#ui.refresh(); }
  dispose() { this.#ui.dispose(); this.#scope.dispose(); }
}
