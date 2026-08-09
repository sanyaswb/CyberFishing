class InventoryV2Facade {
  #commands;
  #viewModels;
  #gameplayBridge;
  #listeners = new Set();
  #migrationWarnings;

  constructor({
    commands,
    viewModels,
    gameplayBridge,
    migrationWarnings = [],
  } = {}) {
    if (typeof commands?.dispatch !== "function") {
      throw new TypeError("InventoryV2Facade requires InventoryV2CommandService");
    }
    if (typeof viewModels?.create !== "function") {
      throw new TypeError("InventoryV2Facade requires InventoryV2ViewModelFactory");
    }
    this.#commands = commands;
    this.#viewModels = viewModels;
    this.#gameplayBridge = gameplayBridge;
    this.#migrationWarnings = Object.freeze([...(migrationWarnings || [])]);
    this.#gameplayBridge?.setAfterMutation?.((result) =>
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
      throw new TypeError("InventoryV2Facade.subscribe requires a listener");
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

  getLegacyBridge() {
    return this.#gameplayBridge;
  }

  handleRodRetrieved(context = {}) {
    return this.#gameplayBridge?.handleRodRetrieved?.(context);
  }

  handleHandChumUsed(context = {}) {
    return this.#gameplayBridge?.handleHandChumUsed?.(context);
  }

  handleBoatReturned(context = {}) {
    return this.#gameplayBridge?.handleBoatReturned?.(context);
  }

  getMigrationWarnings() {
    return [...this.#migrationWarnings];
  }

  setBoatChargeProvider(provider) {
    this.#gameplayBridge?.setBoatChargeProvider?.(provider);
    return this;
  }
}

globalThis.InventoryV2Facade = InventoryV2Facade;
