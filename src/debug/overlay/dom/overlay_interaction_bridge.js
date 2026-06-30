class OverlayInteractionBridge {
  #rootElement;
  #rootElementProvider;
  #viewStateStore;
  #isAttached = false;
  #boundClickHandler = (event) => this.#handleClick(event);
  #boundPointerDownHandler = (event) => this.#handlePointerDown(event);
  #lastPointerHandledAt = 0;

  constructor({ rootElement = null, rootElementProvider = null, viewStateStore } = {}) {
    this.#rootElement = rootElement;
    this.#rootElementProvider = rootElementProvider;
    this.#viewStateStore = viewStateStore;
  }

  attach() {
    if (this.#isAttached) return;
    const root = this.#resolveRootElement();
    if (!root || !this.#viewStateStore) return;

    root.addEventListener("pointerdown", this.#boundPointerDownHandler, true);
    root.addEventListener("mousedown", this.#boundPointerDownHandler, true);
    root.addEventListener("click", this.#boundClickHandler);
    this.#rootElement = root;
    this.#isAttached = true;
  }

  detach() {
    if (!this.#isAttached || !this.#rootElement) return;
    this.#rootElement.removeEventListener(
      "pointerdown",
      this.#boundPointerDownHandler,
      true,
    );
    this.#rootElement.removeEventListener(
      "mousedown",
      this.#boundPointerDownHandler,
      true,
    );
    this.#rootElement.removeEventListener("click", this.#boundClickHandler);
    this.#isAttached = false;
  }

  #handlePointerDown(event) {
    const control = event.target?.closest?.("[data-overlay-control]");
    if (!control || !this.#rootElement?.contains(control)) return;
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

  #handleClick(event) {
    const control = event.target?.closest?.("[data-overlay-control]");
    if (!control || !this.#rootElement?.contains(control)) return;

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

window.OverlayInteractionBridge = OverlayInteractionBridge;
