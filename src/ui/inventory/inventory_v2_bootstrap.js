class InventoryV2Bootstrap {
  static create({ autoMount = true, autoOpen = false, ...options } = {}) {
    const ui = new globalThis.InventoryV2UI(options);
    if (autoMount) ui.mount();
    if (autoOpen) ui.open();
    return ui;
  }
}

globalThis.InventoryV2Bootstrap = InventoryV2Bootstrap;
