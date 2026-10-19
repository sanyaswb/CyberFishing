/**
 * Coordinator for radial inventory selector mode (TK-008.1, TK-008.5).
 * Synchronizes classic toolbar shortcuts vs radial selector visibility,
 * subscribes to runtime configuration events, and dispatches section selection.
 */
export class InventoryRadialSelectorCoordinator {
  #inventoryUI;
  #keepnetView;
  #renderer;
  #controller;
  #config;
  #document;
  #isRadial = false;
  #visibilityUnsubscribe = null;
  #artworkUnsubscribe = null;
  #onConfigUpdateBind = null;
  #disposed = false;

  constructor({
    inventoryUI,
    keepnetView = null,
    renderer,
    controller,
    config = null,
    documentRef = null,
  } = {}) {
    if (!inventoryUI) {
      throw new TypeError("InventoryRadialSelectorCoordinator requires inventoryUI");
    }
    if (!renderer) {
      throw new TypeError("InventoryRadialSelectorCoordinator requires renderer");
    }
    if (!controller) {
      throw new TypeError("InventoryRadialSelectorCoordinator requires controller");
    }

    this.#inventoryUI = inventoryUI;
    this.#keepnetView = keepnetView;
    this.#renderer = renderer;
    this.#controller = controller;
    this.#config = config;
    this.#document = documentRef;

    // Listen to inventory visibility changes: when inventory opens, fold selector
    this.#visibilityUnsubscribe = this.#inventoryUI.onVisibilityChange?.((isOpen) => {
      if (isOpen) {
        this.#controller.cancel();
      }
    });

    // Listen to keepnet artwork changes
    if (this.#keepnetView) {
      this.#artworkUnsubscribe = this.#keepnetView.onArtworkChange?.((imagePath) => {
        this.#renderer.updateKeepnetArt(imagePath);
      });
      if (this.#keepnetView.artworkPath) {
        this.#renderer.updateKeepnetArt(this.#keepnetView.artworkPath);
      }
    }

    // Config updates listener (DEV tools live-switch)
    this.#onConfigUpdateBind = (event) => this.#handleConfigUpdated(event);
    this.#document?.addEventListener?.("config-updated", this.#onConfigUpdateBind);

    // Initial mode check
    const initialRadial = Boolean(this.#config?.ui?.inventorySelector?.radialEnabled);
    this.setRadialMode(initialRadial);
  }

  get isRadial() {
    return this.#isRadial;
  }

  get renderer() {
    return this.#renderer;
  }

  get controller() {
    return this.#controller;
  }

  setKeepnetView(view) {
    this.#artworkUnsubscribe?.();
    this.#artworkUnsubscribe = null;
    this.#keepnetView = view;
    if (view) {
      this.#artworkUnsubscribe = view.onArtworkChange?.((imagePath) => {
        this.#renderer.updateKeepnetArt(imagePath);
      });
      if (view.artworkPath) {
        this.#renderer.updateKeepnetArt(view.artworkPath);
      }
      view.setShortcutVisible(!this.#isRadial);
    }
  }

  setRadialMode(radial) {
    if (this.#disposed) return;
    const nextRadial = Boolean(radial);
    this.#isRadial = nextRadial;

    if (nextRadial) {
      // Hide classic shortcuts
      this.#inventoryUI.setShortcutVisible(false);
      this.#keepnetView?.setShortcutVisible(false);
      // Show radial selector
      if (this.#renderer.element) {
        this.#renderer.element.hidden = false;
      }
    } else {
      // Cancel active radial gestures/fan
      this.#controller.cancel();
      // Hide radial selector
      if (this.#renderer.element) {
        this.#renderer.element.hidden = true;
      }
      // Show classic shortcuts
      this.#inventoryUI.setShortcutVisible(true);
      this.#keepnetView?.setShortcutVisible(true);
    }
  }

  #handleConfigUpdated(event) {
    const detail = event?.detail;
    const path = detail?.path;

    const isTarget = !path || (Array.isArray(path) && path[0] === "CONFIG" && (
      path.length === 1 ||
      (path[1] === "ui" && (path.length === 2 || path[2] === "inventorySelector"))
    ));

    if (isTarget) {
      const nextRadial = Boolean(this.#config?.ui?.inventorySelector?.radialEnabled);
      this.setRadialMode(nextRadial);
    }
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#onConfigUpdateBind && this.#document?.removeEventListener) {
      this.#document.removeEventListener("config-updated", this.#onConfigUpdateBind);
      this.#onConfigUpdateBind = null;
    }
    this.#visibilityUnsubscribe?.();
    this.#visibilityUnsubscribe = null;
    this.#artworkUnsubscribe?.();
    this.#artworkUnsubscribe = null;
    this.#controller?.dispose();
    this.#renderer?.dispose();
    this.#inventoryUI.setShortcutVisible(true);
    this.#keepnetView?.setShortcutVisible(true);
  }
}
