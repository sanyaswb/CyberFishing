export class OverlayInteractionBridge {
  #rootElement;
  #rootElementProvider;
  #roots = new Set();
  #viewStateStore;
  #actions;
  #isAttached = false;
  #boundClickHandler = (event) => this.#handleClick(event);
  #boundPointerDownHandler = (event) => this.#handlePointerDown(event);
  #boundPointerUpHandler = (event) => this.#handlePointerUp(event);
  #lastPointerHandledAt = 0;

  // actions: { [controlType]: () => void } for controls marked data-overlay-activate="release" (spec 157: copying the
  // startup report). They run on pointerup, which carries the user activation the clipboard needs on touch screens,
  // and the control is looked up at release time because the overlay may have rebuilt its HTML since pointerdown.
  constructor({ rootElement = null, rootElementProvider = null, viewStateStore, actions = {} } = {}) {
    this.#rootElement = rootElement;
    this.#rootElementProvider = rootElementProvider;
    this.#viewStateStore = viewStateStore;
    this.#actions = actions;
  }

  attach() {
    if (this.#isAttached) return;
    if (!this.#viewStateStore) return;
    this.#isAttached = true;
    const root = this.#resolveRootElement();
    if (root) this.attachRoot(root);
  }

  attachRoot(root) {
    if (!root || this.#roots.has(root) || !this.#viewStateStore) return;
    root.addEventListener("pointerdown", this.#boundPointerDownHandler, true);
    root.addEventListener("mousedown", this.#boundPointerDownHandler, true);
    root.addEventListener("pointerup", this.#boundPointerUpHandler, true);
    root.addEventListener("click", this.#boundClickHandler);
    this.#roots.add(root);
  }

  detachRoot(root) {
    if (!root || !this.#roots.has(root)) return;
    root.removeEventListener("pointerdown", this.#boundPointerDownHandler, true);
    root.removeEventListener("mousedown", this.#boundPointerDownHandler, true);
    root.removeEventListener("pointerup", this.#boundPointerUpHandler, true);
    root.removeEventListener("click", this.#boundClickHandler);
    this.#roots.delete(root);
  }

  detach() {
    for (const root of [...this.#roots]) {
      this.detachRoot(root);
    }
    this.#isAttached = false;
  }

  #ownsControl(control) {
    for (const root of this.#roots) {
      if (root.contains(control)) return true;
    }
    return false;
  }

  #handlePointerDown(event) {
    const control = event.target?.closest?.("[data-overlay-control]");
    if (!control || !this.#ownsControl(control)) return;
    if (this.#isReleaseControl(control)) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (event.type === "mousedown" && now - this.#lastPointerHandledAt < 400) {
      return;
    }
    this.#lastPointerHandledAt = now;
    this.#activateControl(control, event);
  }

  #handlePointerUp(event) {
    const control = event.target?.closest?.("[data-overlay-control]");
    if (!control || !this.#ownsControl(control) || !this.#isReleaseControl(control)) return;
    event.preventDefault();
    event.stopPropagation();
    this.#lastPointerHandledAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.#actions[control.getAttribute("data-overlay-control")]?.();
  }

  #isReleaseControl(control) {
    return control.getAttribute("data-overlay-activate") === "release";
  }

  #handleClick(event) {
    const control = event.target?.closest?.("[data-overlay-control]");
    if (!control || !this.#ownsControl(control)) return;
    if (this.#isReleaseControl(control)) {
      // Keyboard activation (Enter/Space) has no pointerup; a pointer release already ran the action.
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      event.preventDefault();
      event.stopPropagation();
      if (now - this.#lastPointerHandledAt >= 400) this.#actions[control.getAttribute("data-overlay-control")]?.();
      return;
    }

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - this.#lastPointerHandledAt < 400) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    this.#activateControl(control, event);
  }

  #activateControl(control, event) {
    const controlType = control.getAttribute("data-overlay-control");
    if (controlType === "fish-state-direction") {
      this.#handleFishStateDirection(control, event);
      return;
    }
    if (controlType === "fish-state-force-detail") {
      this.#handleFishStateForceDetail(control, event);
    }
  }

  #handleFishStateDirection(control, event) {
    event.preventDefault();
    event.stopPropagation();

    const value = control.getAttribute("data-overlay-value") || "away";
    this.#viewStateStore.set("fishStatesDirectionMode", value);
  }

  #handleFishStateForceDetail(control, event) {
    event.preventDefault();
    event.stopPropagation();

    const value = control.getAttribute("data-overlay-value") || "";
    if (!["active", "force", "speed", "weight"].includes(value)) return;

    const current = this.#viewStateStore.get("fishStateForceDetails", {});
    this.#viewStateStore.set("fishStateForceDetails", {
      ...current,
      [value]: !current[value],
    });
  }

  #resolveRootElement() {
    if (this.#rootElement?.isConnected) return this.#rootElement;
    if (typeof this.#rootElementProvider === "function") {
      return this.#rootElementProvider();
    }
    return this.#rootElement;
  }
}
