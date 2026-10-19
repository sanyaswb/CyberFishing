/**
 * Browser DOM gesture and interaction controller for the radial inventory selector (TK-008.3, TK-008.4, TK-008.5).
 * Coordinates desktop hover, mobile press-move-release gestures, and accessible keyboard navigation.
 */
export class InventoryRadialSelectorController {
  #renderer;
  #uiSurface;
  #window;
  #onSelect;
  #onStateChange;

  #activePointerId = null;
  #candidateSectionId = null;
  #suppressClickUntil = 0;
  #hoverSuppressedUntilLeave = false;
  #surfaceUnsubscribe = null;
  #cachedMetrics = null;
  #disposed = false;

  constructor({
    renderer,
    uiSurface = null,
    windowRef = typeof window !== "undefined" ? window : null,
    onSelect = () => {},
    onStateChange = null,
  } = {}) {
    if (!renderer) {
      throw new TypeError("InventoryRadialSelectorController requires renderer");
    }
    this.#renderer = renderer;
    this.#uiSurface = uiSurface;
    this.#window = windowRef;
    this.#onSelect = onSelect;
    this.#onStateChange = onStateChange;

    this.#bindEvents();
  }

  get activePointerId() {
    return this.#activePointerId;
  }

  get candidateSectionId() {
    return this.#candidateSectionId;
  }

  /**
   * Closes selector and cancels any active gesture.
   */
  cancel() {
    this.#resetGesture();
    this.#renderer.setOpen(false, { animated: false });
    this.#notifyStateChange();
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#surfaceUnsubscribe?.();
    this.#surfaceUnsubscribe = null;
    this.#unbindEvents();
    this.#resetGesture();
    this.#renderer = null;
  }

  #bindEvents() {
    const root = this.#renderer.element;
    const trigger = this.#renderer.triggerElement;

    // Pointer events on trigger button
    trigger.addEventListener("pointerdown", this.#onTriggerPointerDown);
    trigger.addEventListener("pointerenter", this.#onTriggerPointerEnter);
    trigger.addEventListener("click", this.#onTriggerClick);
    trigger.addEventListener("keydown", this.#onTriggerKeyDown);

    // Pointer events on root/fan container
    root.addEventListener("pointermove", this.#onRootPointerMove);
    root.addEventListener("pointerup", this.#onRootPointerUp);
    root.addEventListener("pointercancel", this.#onRootPointerCancel);
    root.addEventListener("lostpointercapture", this.#onRootLostPointerCapture);
    root.addEventListener("pointerleave", this.#onRootPointerLeave);
    root.addEventListener("focusout", this.#onRootFocusOut);

    // Sector button events (click & keyboard)
    for (const [id, btn] of [
      ["equipment", this.#renderer.getSectorButton("equipment")],
      ["backpack", this.#renderer.getSectorButton("backpack")],
      ["keepnet", this.#renderer.getSectorButton("keepnet")],
    ]) {
      if (btn) {
        btn.addEventListener("click", (e) => this.#onSectorClick(e, id));
        btn.addEventListener("keydown", (e) => this.#onSectorKeyDown(e, id));
      }
    }

    // Surface metrics subscription (hover capability & resize)
    if (this.#uiSurface && typeof this.#uiSurface.subscribe === "function") {
      this.#surfaceUnsubscribe = this.#uiSurface.subscribe((metrics) => {
        if (!metrics.hoverEnabled && this.#renderer.isOpen && this.#activePointerId === null) {
          this.cancel();
        }
      });
    }

    // Window events for safety
    if (typeof this.#window?.addEventListener === "function") {
      this.#window.addEventListener("blur", this.#onWindowBlur);
      this.#window.addEventListener("pagehide", this.#onWindowBlur);
    }
  }

  #unbindEvents() {
    const root = this.#renderer?.element;
    const trigger = this.#renderer?.triggerElement;
    if (!root || !trigger) return;

    trigger.removeEventListener("pointerdown", this.#onTriggerPointerDown);
    trigger.removeEventListener("pointerenter", this.#onTriggerPointerEnter);
    trigger.removeEventListener("click", this.#onTriggerClick);
    trigger.removeEventListener("keydown", this.#onTriggerKeyDown);

    root.removeEventListener("pointermove", this.#onRootPointerMove);
    root.removeEventListener("pointerup", this.#onRootPointerUp);
    root.removeEventListener("pointercancel", this.#onRootPointerCancel);
    root.removeEventListener("lostpointercapture", this.#onRootLostPointerCapture);
    root.removeEventListener("pointerleave", this.#onRootPointerLeave);
    root.removeEventListener("focusout", this.#onRootFocusOut);

    if (typeof this.#window?.removeEventListener === "function") {
      this.#window.removeEventListener("blur", this.#onWindowBlur);
      this.#window.removeEventListener("pagehide", this.#onWindowBlur);
    }
  }

  #onTriggerPointerDown = (event) => {
    // Only primary button and single active gesture
    if (event.button !== 0 || (this.#activePointerId !== null && this.#activePointerId !== event.pointerId)) {
      return;
    }

    event.preventDefault();
    this.#activePointerId = event.pointerId;
    this.#candidateSectionId = null;

    try {
      this.#renderer.triggerElement.setPointerCapture(event.pointerId);
    } catch {
      // Ignored if capture unsupported in mock/test
    }

    this.#cacheMetrics();
    this.#renderer.setOpen(true, { animated: true });
    this.#notifyStateChange();
  };

  #onTriggerPointerEnter = () => {
    // Desktop hover opening (only if hover enabled and not in touch gesture)
    if (this.#activePointerId !== null) return;
    if (this.#hoverSuppressedUntilLeave) return;

    const hoverEnabled = this.#uiSurface?.getMetrics?.()?.hoverEnabled ?? false;
    if (hoverEnabled) {
      this.#cacheMetrics();
      this.#renderer.setOpen(true, { animated: true });
      this.#notifyStateChange();
    }
  };

  #onRootPointerMove = (event) => {
    // Handle mobile captured gesture or desktop hover tracking
    const isTouchHold = this.#activePointerId !== null && event.pointerId === this.#activePointerId;
    const isHover = this.#activePointerId === null && this.#renderer.isOpen;

    if (!isTouchHold && !isHover) return;

    const coords = this.#resolveLocalPoint(event);
    if (!coords) return;

    const hit = this.#renderer.geometry.hitTest(coords.x, coords.y, {
      isReady: this.#renderer.isReady,
    });

    if (hit && hit.type === "sector") {
      this.#candidateSectionId = hit.id;
      this.#renderer.setHighlightedSector(hit.id);
    } else {
      this.#candidateSectionId = null;
      this.#renderer.setHighlightedSector(null);

      // On desktop hover, check if outside keep-open disk
      if (isHover) {
        const inKeepOpen = this.#renderer.geometry.isInsideKeepOpenArea(coords.x, coords.y);
        if (!inKeepOpen) {
          this.#renderer.setOpen(false);
          this.#notifyStateChange();
        }
      }
    }
    this.#notifyStateChange();
  };

  #onRootPointerUp = (event) => {
    if (this.#activePointerId !== null && event.pointerId === this.#activePointerId) {
      event.preventDefault();
      this.#suppressClickUntil = Date.now() + 350;

      try {
        if (this.#renderer.triggerElement.hasPointerCapture?.(event.pointerId)) {
          this.#renderer.triggerElement.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignored
      }

      const selectedId = this.#candidateSectionId;
      this.#resetGesture();
      this.#renderer.setOpen(false, { animated: false });

      if (selectedId) {
        this.#onSelect(selectedId);
      }
      this.#notifyStateChange();
    }
  };

  #onRootPointerCancel = (event) => {
    if (this.#activePointerId !== null && event.pointerId === this.#activePointerId) {
      this.#resetGesture();
      this.#renderer.setOpen(false, { animated: false });
      this.#notifyStateChange();
    }
  };

  #onRootLostPointerCapture = (event) => {
    if (this.#activePointerId !== null && event.pointerId === this.#activePointerId) {
      this.#resetGesture();
      this.#renderer.setOpen(false, { animated: false });
      this.#notifyStateChange();
    }
  };

  #onRootPointerLeave = (event) => {
    this.#hoverSuppressedUntilLeave = false;
    // On hover exit, close unless in an active touch-hold gesture
    if (this.#activePointerId === null && this.#renderer.isOpen) {
      this.#renderer.setOpen(false);
      this.#notifyStateChange();
    }
  };

  #onTriggerClick = (event) => {
    if (Date.now() < this.#suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Clicking trigger does not select a random section; it toggles fan
    if (this.#renderer.isOpen) {
      this.#renderer.setOpen(false);
    } else {
      this.#cacheMetrics();
      this.#renderer.setOpen(true);
    }
    this.#notifyStateChange();
  };

  #onSectorClick = (event, sectionId) => {
    if (Date.now() < this.#suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    this.#hoverSuppressedUntilLeave = true;
    this.#renderer.setOpen(false, { animated: false });
    this.#onSelect(sectionId);
    this.#notifyStateChange();
  };

  #onTriggerKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!this.#renderer.isOpen) {
        this.#renderer.setOpen(true, { animated: false });
        // Focus first sector (equipment)
        const firstBtn = this.#renderer.getSectorButton("equipment");
        firstBtn?.focus();
      } else {
        this.#renderer.setOpen(false, { animated: false });
      }
      this.#notifyStateChange();
    }
  };

  #onSectorKeyDown = (event, sectionId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.#renderer.setOpen(false, { animated: false });
      this.#onSelect(sectionId);
      this.#notifyStateChange();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.#renderer.setOpen(false, { animated: false });
      this.#renderer.triggerElement.focus();
      this.#notifyStateChange();
    }
  };

  #onRootFocusOut = (event) => {
    // If focus moves outside the component entirely, close without selection
    const nextTarget = event.relatedTarget;
    if (nextTarget && this.#renderer.element.contains(nextTarget)) {
      return;
    }
    if (this.#renderer.isOpen && this.#activePointerId === null) {
      this.#renderer.setOpen(false, { animated: false });
      this.#notifyStateChange();
    }
  };

  #onWindowBlur = () => {
    if (this.#renderer?.isOpen) {
      this.cancel();
    }
  };

  #resetGesture() {
    this.#activePointerId = null;
    this.#candidateSectionId = null;
    this.#cachedMetrics = null;
  }

  #cacheMetrics() {
    const trigger = this.#renderer.triggerElement;
    const rect = trigger.getBoundingClientRect?.() || { left: 0, top: 0, right: 48, bottom: 48, width: 48, height: 48 };
    const right = typeof rect.right === "number" ? rect.right : (Number(rect.left) || 0) + (Number(rect.width) || 48);
    const bottom = typeof rect.bottom === "number" ? rect.bottom : (Number(rect.top) || 0) + (Number(rect.height) || 48);

    this.#cachedMetrics = {
      triggerRect: {
        left: Number(rect.left) || 0,
        top: Number(rect.top) || 0,
        right,
        bottom,
        width: Number(rect.width) || 48,
        height: Number(rect.height) || 48,
      },
    };
  }

  #resolveLocalPoint(event) {
    if (!this.#cachedMetrics) this.#cacheMetrics();
    const triggerRect = this.#cachedMetrics.triggerRect;

    let clientX = Number(event.clientX) || 0;
    let clientY = Number(event.clientY) || 0;

    let dx, dy;
    if (this.#uiSurface && typeof this.#uiSurface.physicalToLogicalPoint === "function") {
      const logicalTrigger = this.#uiSurface.physicalToLogicalPoint({
        x: triggerRect.right,
        y: triggerRect.bottom,
      });
      const logicalPointer = this.#uiSurface.physicalToLogicalPoint({
        x: clientX,
        y: clientY,
      });
      dx = logicalTrigger.x - logicalPointer.x;
      dy = logicalTrigger.y - logicalPointer.y;
    } else {
      dx = triggerRect.right - clientX;
      dy = triggerRect.bottom - clientY;
    }

    const geo = this.#renderer.geometry;
    return {
      x: geo.center.x - dx,
      y: geo.center.y - dy,
    };
  }

  #notifyStateChange() {
    this.#onStateChange?.({
      isOpen: this.#renderer?.isOpen ?? false,
      candidateSectionId: this.#candidateSectionId,
    });
  }
}
