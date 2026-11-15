import { KeepnetDevSection } from "../keepnet_dev_section.js";

// «DEBUG (CONFIG.debug)» (spec 174 B3, moved from DevTools): CONFIG.debug without the overlay switches (their own
// module), the camera follow switch, the inventory diagnostics with the split layout, and the keepnet fill.
export class DebugModule {
  #config;
  #keepnet;

  // keepnet: the keepnet's DEV port (KeepnetDevSection) or null.
  constructor({ config, keepnet = null }) {
    this.#config = config;
    this.#keepnet = keepnet;
  }

  mount(host, { ui, createSection, tree, edits }) {
    const debug = this.#config.debug;
    if (!debug) return;
    const content = createSection("DEBUG (CONFIG.debug)", host, ["CONFIG", "debug"], { icon: "bug" });
    tree.render(debug, content, ["CONFIG", "debug"], { groupedDebug: true });
    // TK-260: which stays in view when the fish runs far: the rod (off) or the fish / float (on). It edits the game's
    // own setting CONFIG.locations.cameraFollowPriority live (spec 153 D1).
    if (this.#config.locations) {
      // The switch binds its own path: config syncs carry "rod" / "tackle", a switch shows only true.
      const priorityPath = ["CONFIG", "locations", "cameraFollowPriority"];
      const switchPath = ["DEBUG_CAMERA", "followsTackle"];
      ui.createSwitcherRow("Камера тримає рибу (інакше — вудку в кадрі)",
        this.#config.locations.cameraFollowPriority === "tackle", content, (enabled) => {
          edits.update(priorityPath, enabled ? "tackle" : "rod");
          ui.syncValue(switchPath, enabled);
        }, switchPath);
    }
    const inventory = createSection("Inventory", content, ["DEBUG_INVENTORY"]);
    if (debug.inventory) tree.render(debug.inventory, inventory, ["CONFIG", "debug", "inventory"]);
    if (debug.inventorySplit) {
      const splitPath = ["CONFIG", "debug", "inventorySplit"];
      tree.render(debug.inventorySplit, createSection("Split", inventory, splitPath), splitPath);
    }
    // TK-227/228: the keepnet fill lives under DEBUG, not among the main sections.
    if (this.#keepnet) new KeepnetDevSection({ ui, keepnet: this.#keepnet, createSection }).render(content);
  }
}
