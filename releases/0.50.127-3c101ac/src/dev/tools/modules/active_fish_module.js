// «ACTIVE FISH» (spec 174 B3, moved from DevTools): the fish on the hook with its runtime parameters, editable live,
// and the global fight config shortcuts beside it. It draws into its own slot, so a new fish (or a new shape of its
// tree) redraws only these sections (B4).
export class ActiveFishModule {
  #getHookedFish;
  #policy;
  #edits = null;
  #slot = null;
  #context = null;
  #fishKey = "";
  #shapeKey = "";

  // getHookedFish(): the live hooked fish or null; policy: ActiveFishDevToolsVisibilityPolicy.
  constructor({ getHookedFish, policy }) {
    this.#getHookedFish = getHookedFish;
    this.#policy = policy;
  }

  mount(host, context) {
    this.#context = context;
    this.#edits = context.edits;
    this.#slot = context.ui.createSectionSlot(host);
    this.refresh();
  }

  // Whether the fish on the hook (its id, level, weight or the shape of its tree) differs from the one drawn.
  get hasChanged() {
    return this.#keyOf() !== this.#fishKey || this.#shapeOf() !== this.#shapeKey;
  }

  refresh() {
    this.#fishKey = this.#keyOf();
    this.#shapeKey = this.#shapeOf();
    const slot = this.#slot;
    if (!slot) return;
    const { ui } = this.#context;
    ui.releaseValueBindings(slot);
    slot.replaceChildren();
    this.#render(slot);
  }

  #render(host) {
    const hookedFish = this.#getHookedFish();
    if (!hookedFish) return;
    const { createSection, tree } = this.#context;
    const fish = this.#policy.normalizeHookedFish(hookedFish);
    const content = createSection(`ACTIVE FISH (${fish.id || fish.name || "hookedFish"})`, host, ["HOOKED_FISH"], { icon: "fish" });
    const runtime = createSection(this.#policy.fishRuntimeRootTitle, content, ["HOOKED_FISH"]);
    tree.render(fish, runtime, ["HOOKED_FISH"], { visibilityPolicy: this.#policy, applyHookedFishLegacySkips: false });
    const shortcuts = this.#policy.getGlobalConfigShortcuts();
    if (!shortcuts.length) return;
    const global = createSection(this.#policy.globalConfigRootTitle, content, ["CONFIG"]);
    for (const shortcut of shortcuts) {
      const value = this.#edits.read(shortcut.path);
      if (!value || typeof value !== "object") continue;
      tree.render(value, createSection(shortcut.title || shortcut.path.join("."), global, shortcut.path), shortcut.path);
    }
  }

  #keyOf() {
    const fish = this.#getHookedFish();
    return fish ? `${fish.id || fish.name || "hookedFish"}:${fish.level ?? ""}:${fish.weight ?? ""}` : "";
  }

  #shapeOf() {
    const fish = this.#getHookedFish();
    if (!fish || !this.#context) return "";
    return this.#context.tree.visibleScalarPaths(fish, ["HOOKED_FISH"],
      { visibilityPolicy: this.#policy, applyHookedFishLegacySkips: false }).join("|");
  }
}
