// Results of inventory commands; `refresh` tells the inventory UI to rebuild its view model.
export function inventoryCommandSuccess(extra = {}) {
  return Object.freeze({ success: true, warning: null, refresh: true, ...extra });
}

export function inventoryCommandFailure(warning, error = null) {
  return Object.freeze({
    success: false,
    warning,
    refresh: true,
    error,
  });
}
