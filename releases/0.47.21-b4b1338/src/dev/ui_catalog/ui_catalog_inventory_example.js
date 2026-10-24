// The whole production inventory with its keepnet section attached, as in the game (spec 140 R2-D4). section opens
// one section (the keepnet card); its states and value then drive the keepnet fixture, otherwise the inventory's.
export class UiCatalogInventoryExample {
  #fixture;
  #keepnetFixture;
  #ui;
  #keepnet;
  #scope;
  #surface;
  #status;
  #section;
  constructor({ fixture, keepnetFixture, ui, documentScope, surface, status, attachKeepnet, section = null }) {
    this.#fixture = fixture; this.#keepnetFixture = keepnetFixture; this.#ui = ui; this.#scope = documentScope;
    this.#surface = surface; this.#status = status; this.#section = section;
    ui.mount();
    this.#keepnet = attachKeepnet();
    ui.rootNode.classList.add("ui-catalog-preview__overlay");
    ui.rootNode.setAttribute("aria-modal", "false");
    for (const button of surface.mountRoot.querySelectorAll(".inventory-backpack-button, .keepnet-button")) {
      button.classList.add("ui-catalog-preview__toolbar");
    }
    ui.open();
    if (section) ui.openSection(section);
  }
  setState(state) {
    if (this.#section === "keepnet") {
      this.#keepnetFixture.reset(state);
      this.#ui.openSection("keepnet");
      this.#keepnet.refresh();
    } else {
      this.#fixture.reset(state);
      this.#ui.open();
      this.#ui.refresh();
    }
    this.#status.textContent = "";
    this.#surface.measure();
  }
  setValue(value) {
    if (this.#section === "keepnet") {
      this.#keepnetFixture.setValue(value);
      this.#keepnet.refresh();
      return;
    }
    this.#fixture.setValue(value);
    this.#ui.updateDynamicProgression(250);
  }
  dispose() { this.#keepnet.dispose(); this.#ui.dispose(); this.#scope.dispose(); }
}
