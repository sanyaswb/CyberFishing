// Landscape split inventory (spec 098): applies InventorySplitLayoutPolicy to the page. The canvas is sized to the game
// strip (getViewport for CanvasMetricsProvider) and placed on its side (originX for world input); HUD anchored to the
// screen edges follows the --ui-edge-* variables, centred HUD the strip centre; the inventory surface takes its share
// and reports it as its logical width, so a share under 821px gets the inventory's mobile layout.
// The game is told once per split change (open, close, side or share), not on a plain window resize, so it can keep
// the rod's world position. Only DEV composes it; production has no stage.
export class GameStageLayout {
  #canvas;
  #window;
  #surface;
  #source;
  #policy;
  #listeners;
  #viewport = { width: 0, height: 0 };
  #layout = null;
  #open = false;
  #side = null;
  #inventorySurface = null;
  #getRodScreenX = () => null;
  #onSplitChange = null;
  #removeVisibilityListener = null;
  #removeSourceListener = null;

  constructor({ canvas, windowRef, uiSurface, source, policy, listeners }) {
    this.#canvas = canvas;
    this.#window = windowRef;
    this.#surface = uiSurface || null;
    this.#source = source;
    this.#policy = policy;
    this.#listeners = listeners;
    this.#listeners.add(windowRef, "resize", () => this.#update(false));
    this.#removeSourceListener = source.subscribe(() => this.#update(true));
    this.#update(false);
  }

  get originX() {
    return this.#layout.stageLeft;
  }

  get layout() {
    return this.#layout;
  }

  // CanvasMetricsProvider's viewport: the strip while the split is active, the window otherwise.
  getViewport() {
    this.#viewport.width = this.#layout.stageWidth;
    this.#viewport.height = this.#layout.stageHeight;
    return this.#viewport;
  }

  attachInventory(inventoryUI) {
    this.#inventorySurface = inventoryUI.surfaceNode;
    this.#removeVisibilityListener?.();
    this.#removeVisibilityListener = inventoryUI.onVisibilityChange((open) => {
      this.#open = open;
      // The side is chosen on opening and kept while the inventory stays open.
      if (open) {
        // The canvas's logical width is the strip (spec 100: canvas.width is the backing store, device pixels).
        this.#side = this.#policy.sideForRod(this.#getRodScreenX(), Math.trunc(this.#layout.stageWidth),
          this.#source.resolve().defaultSide);
      }
      this.#update(true);
    });
    this.#open = inventoryUI.isOpen;
    this.#update(false);
  }

  attachGame({ getRodScreenX, onSplitChange }) {
    this.#getRodScreenX = getRodScreenX;
    this.#onSplitChange = onSplitChange;
  }

  // Owns its source and listeners; the page returns to the full-screen layout.
  dispose() {
    this.#removeVisibilityListener?.();
    this.#removeSourceListener?.();
    this.#listeners.dispose();
    this.#source.dispose?.();
    this.#onSplitChange = null;
    this.#open = false;
    this.#apply(this.#policy.resolve({ width: this.#window.innerWidth, height: this.#window.innerHeight }));
  }

  #update(notify) {
    const next = this.#policy.resolve({ settings: this.#source.resolve(), width: this.#window.innerWidth,
      height: this.#window.innerHeight, open: this.#open, side: this.#side });
    const previous = this.#layout;
    if (previous && previous.active === next.active && previous.side === next.side &&
      previous.inventoryWidth === next.inventoryWidth && previous.stageWidth === next.stageWidth &&
      previous.stageHeight === next.stageHeight) return;
    this.#apply(next);
    if (notify) this.#onSplitChange?.();
  }

  #apply(layout) {
    this.#layout = layout;
    const canvas = this.#canvas;
    canvas.classList.toggle("game-shell__canvas--staged", layout.active);
    if (layout.active) canvas.style.setProperty("--game-stage-left", `${layout.stageLeft}px`);
    else canvas.style.removeProperty("--game-stage-left");
    // On the surface root, so content and portal layers (the DEV tools toggle) follow the strip alike.
    const surface = this.#surface;
    if (surface) {
      for (const side of ["left", "right"]) {
        surface.setLayoutProperty(`--ui-edge-${side}`, layout.active && layout.side === side
          ? `calc(${layout.inventoryWidth}px + max(12px, var(--ui-safe-area-${side}, 0px)))` : null);
      }
      surface.setLayoutProperty("--ui-stage-center-x",
        layout.active ? `${layout.stageLeft + layout.stageWidth / 2}px` : null);
    }
    const inventory = this.#inventorySurface;
    if (inventory) {
      inventory.classList.toggle("inventory-surface--split", layout.active);
      inventory.classList.toggle("inventory-surface--split-left", layout.active && layout.side === "left");
      inventory.classList.toggle("inventory-surface--split-right", layout.active && layout.side === "right");
      for (const [name, value] of [["--inventory-split-width", `${layout.inventoryWidth}px`],
        ["--ui-logical-width", `${layout.inventoryWidth}px`]]) {
        if (layout.active) inventory.style.setProperty(name, value);
        else inventory.style.removeProperty(name);
      }
    }
  }
}
