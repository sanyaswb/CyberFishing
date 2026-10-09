export class InventoryFacade {
  #commands;
  #viewModels;
  #gameplayBridge;
  #listeners = new Set();

  constructor({
    commands,
    viewModels,
    gameplayBridge,
  } = {}) {
    if (typeof commands?.dispatch !== "function") {
      throw new TypeError("InventoryFacade requires InventoryCommandService");
    }
    if (typeof viewModels?.create !== "function") {
      throw new TypeError("InventoryFacade requires InventoryViewModelFactory");
    }
    for (const method of ["setAfterMutation", "handleRodRetrieved", "handleHandChumUsed", "handleBoatReturned",
      "setBoatChargeProvider"]) {
      if (typeof gameplayBridge?.[method] !== "function") {
        throw new TypeError(`InventoryFacade requires InventoryGameplayBridge.${method}`);
      }
    }
    this.#commands = commands;
    this.#viewModels = viewModels;
    this.#gameplayBridge = gameplayBridge;
    this.#gameplayBridge.setAfterMutation((result) =>
      this.notify({ warning: result?.warning || result?.report?.warning || null }),
    );
  }

  getViewModel() {
    return this.#viewModels.create(this.#commands.getUiState());
  }

  dispatch(action) {
    const result = this.#commands.dispatch(action);
    this.notify();
    return Object.freeze({ ...result, refresh: false });
  }

  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("InventoryFacade.subscribe requires a listener");
    }
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  notify({ warning = null } = {}) {
    const viewModel = this.getViewModel();
    const payload = warning
      ? Object.freeze({ viewModel, warning })
      : viewModel;
    for (const listener of [...this.#listeners]) listener(payload);
    return viewModel;
  }

  handleRodRetrieved(context = {}) {
    return this.#gameplayBridge.handleRodRetrieved(context);
  }

  handleHandChumUsed(context = {}) {
    return this.#gameplayBridge.handleHandChumUsed(context);
  }

  handleBoatReturned(context = {}) {
    return this.#gameplayBridge.handleBoatReturned(context);
  }

  setBoatChargeProvider(provider) {
    this.#gameplayBridge.setBoatChargeProvider(provider);
    return this;
  }
}
