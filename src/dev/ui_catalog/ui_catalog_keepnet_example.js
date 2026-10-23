export class UiCatalogKeepnetExample {
  #fixture;
  #ui;
  #scope;
  #surface;
  #status;
  #illustrationSource = null;
  constructor({ fixture, ui, documentScope, surface, status }) {
    this.#fixture = fixture; this.#ui = ui; this.#scope = documentScope;
    this.#surface = surface; this.#status = status;
    documentScope.querySelector(".keepnet-button").classList.add("ui-catalog-preview__toolbar");
    ui.setVisible(true);
  }
  setState(state) {
    const image = this.#scope.querySelector(".keepnet-section__icon");
    if (this.#illustrationSource) {
      image.src = this.#illustrationSource;
      this.#illustrationSource = null;
    }
    this.#fixture.reset(state);
    this.#ui.setVisible(false); this.#ui.setVisible(true);
    const illustrations = { portrait: "assets/ui/inventory/rod.svg", wide: "assets/house/room-1/room--1_aqua.webp", square: "assets/ui/inventory/keepnet.svg" };
    if (illustrations[state]) {
      this.#illustrationSource = image.src;
      image.src = illustrations[state];
    }
    this.#status.textContent = "";
    this.#surface.measure();
  }
  setValue(value) { this.#fixture.setValue(value); this.#ui.refresh(); }
  dispose() { this.#ui.dispose(); this.#scope.dispose(); }
}
