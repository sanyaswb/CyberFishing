export class UiCatalogSelectorExample {
  #selector;
  #config;
  #document;
  #inventory;
  #owned;
  constructor({ selector, config, documentScope, inventoryUI, owned }) {
    this.#selector = selector; this.#config = config;
    this.#document = documentScope; this.#inventory = inventoryUI; this.#owned = owned;
  }
  setState(state) {
    this.#inventory.close();
    this.#selector.controller.cancel();
    this.#config.ui.inventorySelector.radialEnabled = state !== "classic";
    this.#config.ui.inventorySelector.size = 1;
    this.#config.ui.inventorySelector.openSize = state === "medium" ? 2 : 3;
    this.#document.body.dispatchEvent(new this.#document.defaultView.CustomEvent("config-updated", { bubbles: true }));
    this.#selector.view.element.classList.toggle("inventory-selector--reduced-motion", state === "reduced-motion");
    if (["open", "equipment", "backpack", "keepnet", "reduced-motion", "medium", "large"].includes(state)) {
      this.#selector.controller.openKeyboard();
      this.#selector.controller.highlight(["equipment", "backpack", "keepnet"].indexOf(state));
    }
  }
  dispose() { for (const resource of this.#owned.slice().reverse()) resource.dispose(); }
}
