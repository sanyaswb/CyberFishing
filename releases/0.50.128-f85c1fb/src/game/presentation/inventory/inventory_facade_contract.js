export class InventoryFacadeContract {
  static assert(facade, { actionDispatcher = null } = {}) {
    if (!facade || typeof facade.getViewModel !== "function") {
      throw new TypeError(
        "InventoryUI requires a facade with getViewModel()",
      );
    }
    if (
      typeof actionDispatcher !== "function" &&
      typeof facade.dispatch !== "function"
    ) {
      throw new TypeError(
        "InventoryUI requires facade.dispatch(action) or onAction(action)",
      );
    }
    if (
      facade.subscribe !== undefined &&
      typeof facade.subscribe !== "function"
    ) {
      throw new TypeError("Inventory facade.subscribe must be a function");
    }
    return facade;
  }
}
