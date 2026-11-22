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
      "setDeviceChargeProvider"]) {
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

  // Spec 151: devices away from the player; actions that would change them are rolled back.
  setBusyDevices(source) {
    this.#commands.setBusyDevices(source);
  }

  // Spec 185 D9: { isActive() } — under radiation or an emission the gas mask's filters change one at a time.
  setFilterSwapRestriction(source) {
    this.#commands.setFilterSwapRestriction(source);
  }

  // Spec 162 stage 2: the chosen live bait in the bait switcher.
  setLiveBaitHook(hook) {
    this.#viewModels.setLiveBaitHook(hook);
    this.#commands.setLiveBaitHook(hook);
  }

  // Spec 179 stage F (TK-340): what a used item does.
  setItemEffects(effects) {
    this.#commands.setItemEffects(effects);
  }

  // Spec 163 stage 2: the backpack's live bait stacks.
  setLiveBaitStacks(stacks) {
    this.#viewModels.setLiveBaitStacks(stacks);
    this.#commands.setLiveBaitStacks(stacks);
  }

  getViewModel() {
    return this.#viewModels.create(this.#commands.getUiState());
  }

  // options: { locked } — the tackle is in the water (spec 185 D9: only the gas mask's filters change).
  dispatch(action, options = {}) {
    const result = this.#commands.dispatch(action, options);
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

  // TK-386: the listeners get { viewModel, warning } with the view model built only when one of them reads it (once): a
  // background write (a battery's charge, the radiation's wear, a gas mask's filter) with the inventory closed builds
  // nothing — the full view model is ~7 ms of cards and parameters.
  notify({ warning = null } = {}) {
    let viewModel = null;
    const facade = this;
    const payload = Object.freeze({
      get viewModel() {
        viewModel ??= facade.getViewModel();
        return viewModel;
      },
      warning,
    });
    for (const listener of [...this.#listeners]) listener(payload);
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

  setDeviceChargeProvider(provider) {
    this.#gameplayBridge.setDeviceChargeProvider(provider);
    return this;
  }
}
