class OverlayViewStateStore {
  #state;
  #listeners = new Set();

  constructor(initialState = {}) {
    this.#state = Object.freeze({
      fishStatesDirectionMode: "away",
      fishStateForceDetails: Object.freeze({
        active: false,
        force: false,
        speed: false,
        weight: false,
      }),
      ...this.#sanitizeInitialState(initialState),
    });
  }

  get(key, fallbackValue = null) {
    return Object.prototype.hasOwnProperty.call(this.#state, key)
      ? this.#state[key]
      : fallbackValue;
  }

  set(key, value) {
    const normalizedValue = this.#normalizeValue(key, value);
    if (this.#areEqual(this.#state[key], normalizedValue)) return;

    this.#state = Object.freeze({
      ...this.#state,
      [key]: normalizedValue,
    });
    this.#emit();
  }

  update(key, updater) {
    if (typeof updater !== "function") return;
    this.set(key, updater(this.get(key)));
  }

  subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  getSnapshot() {
    return { ...this.#state };
  }

  #sanitizeInitialState(initialState) {
    const sanitized = {};
    if (initialState && typeof initialState === "object") {
      sanitized.fishStatesDirectionMode = this.#normalizeFishStatesDirectionMode(
        initialState.fishStatesDirectionMode,
      );
      sanitized.fishStateForceDetails = this.#normalizeFishStateForceDetails(
        initialState.fishStateForceDetails,
      );
    }
    return sanitized;
  }

  #normalizeValue(key, value) {
    if (key === "fishStatesDirectionMode") {
      return this.#normalizeFishStatesDirectionMode(value);
    }
    if (key === "fishStateForceDetails") {
      return this.#normalizeFishStateForceDetails(value);
    }
    return value;
  }

  #normalizeFishStatesDirectionMode(value) {
    return ["away", "side", "toward"].includes(value)
      ? value
      : "away";
  }

  #normalizeFishStateForceDetails(value) {
    const source = value && typeof value === "object" ? value : {};
    return Object.freeze({
      active: !!source.active,
      force: !!source.force,
      speed: !!source.speed,
      weight: !!source.weight,
    });
  }

  #areEqual(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (a[key] !== b[key]) return false;
    }
    return true;
  }

  #emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
}

window.OverlayViewStateStore = OverlayViewStateStore;
