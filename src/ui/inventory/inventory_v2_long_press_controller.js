class InventoryV2LongPressController {
  static DURATION_MS = 1500;
  static EQUIPPED_DURATION_MS = 800;
  static MOVEMENT_TOLERANCE_PX = 8;

  #durationMs;
  #movementTolerancePx;
  #degradationColorResolver;
  #bindings = new Set();

  constructor({
    movementTolerancePx = InventoryV2LongPressController.MOVEMENT_TOLERANCE_PX,
    degradationColorResolver = null,
  } = {}) {
    this.#durationMs = InventoryV2LongPressController.DURATION_MS;
    this.#movementTolerancePx = Math.max(
      0,
      Number(movementTolerancePx) || 0,
    );
    this.#degradationColorResolver = degradationColorResolver;
  }

  get hasActivePress() {
    for (const binding of this.#bindings) {
      if (!binding.disposed && binding.timerId !== null) return true;
    }
    return false;
  }

  bind(
    element,
    {
      onClick = null,
      onLongPress = null,
      durationMs = this.#durationMs,
    } = {},
  ) {
    if (!element?.addEventListener) return () => {};

    const binding = {
      element,
      onClick,
      onLongPress,
      durationMs: Math.max(1, Number(durationMs) || this.#durationMs),
      timerId: null,
      animationFrameId: null,
      startedAt: 0,
      pointerId: null,
      startX: 0,
      startY: 0,
      fired: false,
      disposed: false,
    };
    const progress = this.#createProgressElement(element);
    const pointerDown = (event) => this.#start(binding, event);
    const pointerMove = (event) => this.#move(binding, event);
    const pointerUp = (event) => this.#finish(binding, event);
    const pointerCancel = (event) => this.#cancel(binding, event);
    const click = (event) => this.#click(binding, event);
    const contextMenu = (event) => {
      if (binding.timerId !== null || binding.fired) event.preventDefault();
    };

    Object.assign(binding, {
      progress,
      pointerDown,
      pointerMove,
      pointerUp,
      pointerCancel,
      click,
      contextMenu,
    });
    element.dataset.longPressDuration = String(binding.durationMs);
    element.addEventListener("pointerdown", pointerDown);
    element.addEventListener("pointermove", pointerMove);
    element.addEventListener("pointerup", pointerUp);
    element.addEventListener("pointercancel", pointerCancel);
    element.addEventListener("lostpointercapture", pointerCancel);
    element.addEventListener("click", click);
    element.addEventListener("contextmenu", contextMenu);
    this.#bindings.add(binding);

    return () => this.#disposeBinding(binding);
  }

  clear() {
    for (const binding of [...this.#bindings]) {
      this.#disposeBinding(binding);
    }
  }

  dispose() {
    this.clear();
  }

  #start(binding, event) {
    if (binding.disposed || binding.timerId !== null) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (event.isPrimary === false) return;

    binding.pointerId = event.pointerId;
    binding.startX = Number(event.clientX) || 0;
    binding.startY = Number(event.clientY) || 0;
    binding.fired = false;
    binding.startedAt = this.#now();
    this.#updateProgressVisual(binding, 0);
    binding.element.classList.add("is-long-pressing");
    this.#scheduleProgressUpdate(binding);
    binding.element.setPointerCapture?.(event.pointerId);
    binding.timerId = globalThis.setTimeout(() => {
      binding.timerId = null;
      binding.fired = true;
      this.#stopProgressUpdate(binding);
      this.#updateProgressVisual(binding, 1);
      binding.element.classList.remove("is-long-pressing");
      binding.element.classList.add("is-long-press-fired");
      binding.onLongPress?.(event);
    }, binding.durationMs);
  }

  #move(binding, event) {
    if (!this.#matchesPointer(binding, event) || binding.timerId === null) {
      return;
    }
    const deltaX = Math.abs((Number(event.clientX) || 0) - binding.startX);
    const deltaY = Math.abs((Number(event.clientY) || 0) - binding.startY);
    if (deltaX > this.#movementTolerancePx || deltaY > this.#movementTolerancePx) {
      this.#reset(binding);
    }
  }

  #finish(binding, event) {
    if (!this.#matchesPointer(binding, event)) return;
    this.#releasePointer(binding, event);
    if (!binding.fired) this.#reset(binding);
    binding.pointerId = null;
  }

  #cancel(binding, event) {
    if (!this.#matchesPointer(binding, event)) return;
    this.#releasePointer(binding, event);
    this.#reset(binding);
    binding.pointerId = null;
  }

  #click(binding, event) {
    if (binding.fired) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      binding.fired = false;
      binding.element.classList.remove("is-long-press-fired");
      return;
    }
    binding.onClick?.(event);
  }

  #reset(binding) {
    if (binding.timerId !== null) {
      globalThis.clearTimeout(binding.timerId);
      binding.timerId = null;
    }
    this.#stopProgressUpdate(binding);
    this.#updateProgressVisual(binding, 0);
    binding.element.classList.remove("is-long-pressing");
  }

  #scheduleProgressUpdate(binding) {
    if (typeof globalThis.requestAnimationFrame !== "function") return;
    const update = () => {
      if (binding.disposed || binding.timerId === null) return;
      const elapsed = Math.max(0, this.#now() - binding.startedAt);
      this.#updateProgressVisual(
        binding,
        Math.min(1, elapsed / binding.durationMs),
      );
      binding.animationFrameId = globalThis.requestAnimationFrame(update);
    };
    binding.animationFrameId = globalThis.requestAnimationFrame(update);
  }

  #stopProgressUpdate(binding) {
    if (binding.animationFrameId === null) return;
    globalThis.cancelAnimationFrame?.(binding.animationFrameId);
    binding.animationFrameId = null;
  }

  #updateProgressVisual(binding, ratio) {
    const normalized = Math.max(0, Math.min(1, Number(ratio) || 0));
    binding.progress?.style?.setProperty(
      "--inventory-v2-long-press-angle",
      `${normalized * 360}deg`,
    );
    const color = this.#degradationColorResolver?.resolveWorseningProgress?.(
      normalized * 100,
    );
    if (color?.available !== true) return;
    binding.progress.style.setProperty(
      "--inventory-v2-long-press-color",
      color.cssColor,
    );
    binding.progress.style.setProperty(
      "--inventory-v2-long-press-glow-color",
      color.cssGlowColor,
    );
  }

  #now() {
    return typeof globalThis.performance?.now === "function"
      ? globalThis.performance.now()
      : Date.now();
  }

  #matchesPointer(binding, event) {
    return binding.pointerId === null || binding.pointerId === event.pointerId;
  }

  #releasePointer(binding, event) {
    if (binding.element.hasPointerCapture?.(event.pointerId)) {
      binding.element.releasePointerCapture(event.pointerId);
    }
  }

  #createProgressElement(element) {
    const documentRef = element.ownerDocument || globalThis.document;
    if (!documentRef?.createElement) return null;
    const progress = documentRef.createElement("span");
    progress.className = "inventory-v2-long-press-progress";
    progress.setAttribute("aria-hidden", "true");
    element.appendChild(progress);
    return progress;
  }

  #disposeBinding(binding) {
    if (binding.disposed) return;
    binding.disposed = true;
    this.#reset(binding);
    binding.element.removeEventListener("pointerdown", binding.pointerDown);
    binding.element.removeEventListener("pointermove", binding.pointerMove);
    binding.element.removeEventListener("pointerup", binding.pointerUp);
    binding.element.removeEventListener("pointercancel", binding.pointerCancel);
    binding.element.removeEventListener(
      "lostpointercapture",
      binding.pointerCancel,
    );
    binding.element.removeEventListener("click", binding.click);
    binding.element.removeEventListener("contextmenu", binding.contextMenu);
    binding.element.classList.remove(
      "is-long-pressing",
      "is-long-press-fired",
    );
    binding.progress?.remove();
    this.#bindings.delete(binding);
  }
}

globalThis.InventoryV2LongPressController = InventoryV2LongPressController;
