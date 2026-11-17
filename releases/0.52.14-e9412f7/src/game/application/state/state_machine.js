export class StateMachine {
  #state = null;
  #stateName = "";
  #stateInstances = {};
  #pendingState = null;
  #isTransitioning = false;
  #stateRegistry;
  #onStateChanged;

  constructor({ stateRegistry, onStateChanged }) {
    this.#stateRegistry = stateRegistry;
    this.#onStateChanged = onStateChanged;
  }

  setState(name, data = {}) {
    if (this.#isTransitioning) {
      this.#pendingState = { name, data };
      return;
    }

    this.#isTransitioning = true;
    let next = { name, data };

    try {
      while (next) {
        this.#pendingState = null;
        if (this.#state) this.#state.exit();
        this.#stateName = next.name;
        this.#onStateChanged?.(next.name);
        this.#state = this.#getStateInstance(next.name);
        this.#state.enter(next.data);
        next = this.#pendingState;
      }
    } finally {
      this.#isTransitioning = false;
    }
  }

  #getStateInstance(name) {
    if (this.#stateInstances[name]) return this.#stateInstances[name];
    const state = this.#stateRegistry(name);
    this.#stateInstances[name] = state;
    return state;
  }

  handleInput(input) {
    this.#state?.handleInput(input);
  }

  update(dt, bounds, context) {
    this.#state?.update(dt, bounds, context);
  }

  getRenderState(target, bounds) {
    this.#state?.getRenderState(target, bounds);
  }

  dispose() {
    if (this.#state) this.#state.exit();
    for (const state of Object.values(this.#stateInstances)) {
      state.dispose?.();
    }
  }

  get currentName() {
    return this.#stateName;
  }

  get currentState() {
    return this.#state;
  }
}
