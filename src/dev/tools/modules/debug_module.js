import { KeepnetDevSection } from "../keepnet_dev_section.js";

// «DEBUG (CONFIG.debug)» (spec 174 B3, moved from DevTools): CONFIG.debug without the overlay switches (their own
// module), the camera follow switch, the inventory diagnostics with the split layout, and the keepnet fill.
export class DebugModule {
  #config;
  #keepnet;
  // TK-364: the God mode infinite casting warning (created when «godMode» is first opened) and its shown lines.
  #godNotice = null;
  #godNoticeShown = null;

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
    if (debug.godMode) this.#renderGodMode(content, { ui, createSection, tree });
    // TK-260: which stays in view when the fish runs far: the rod (off) or the fish / float (on). It edits the game's
    // own setting CONFIG.locations.cameraFollowPriority live (spec 153 D1).
    if (this.#config.locations) {
      // The switch binds its own path: config syncs carry "rod" / "tackle", a switch shows only true.
      const priorityPath = ["CONFIG", "locations", "cameraFollowPriority"];
      const switchPath = ["DEBUG_CAMERA", "followsTackle"];
      ui.addParameter(content, {
        control: "switch",
        label: "Камера тримає рибу (інакше — вудку в кадрі)",
        value: this.#config.locations.cameraFollowPriority === "tackle",
        onCommit: (enabled) => {
          edits.update(priorityPath, enabled ? "tackle" : "rod");
          ui.syncValue(switchPath, enabled);
        },
        path: switchPath,
        bindingPath: switchPath,
        configPath: priorityPath,
        isChanged: () => edits.isOverridden(priorityPath),
        onReset: () => {
          edits.resetParameter(priorityPath);
          ui.syncValue(switchPath, this.#config.locations.cameraFollowPriority === "tackle");
        },
      });
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

  // TK-364 (owner): while God mode infinite casting is on, a warning at the top of «godMode» says how the fight's line
  // works then — above all for a pole, which has no reel and is wound by a virtual one with the shown values.
  refreshLive() {
    if (!this.#godNotice) return;
    const text = this.#godNoticeText();
    this.#godNotice.hidden = text === null;
    if (text !== null && text !== this.#godNoticeShown) {
      this.#godNoticeShown = text;
      const lines = Array.from(this.#godNotice.children).filter((child) => child.className === "devtools__alert-line");
      text.forEach((line, index) => { if (lines[index]) lines[index].innerText = line; });
    }
  }

  #renderGodMode(parent, { ui, createSection, tree }) {
    const path = ["CONFIG", "debug", "godMode"];
    createSection("godMode", parent, path, { render: (content) => {
      tree.render(this.#config.debug.godMode, content, path);
      const text = this.#godNoticeText();
      this.#godNoticeShown = text;
      this.#godNotice = ui.createAlert("Нескінченний закид: ліска в боротьбі", text || ["", "", ""], content,
        ["CONFIG", "debug", "godMode", "infiniteCastingNotice"]);
      this.#godNotice.hidden = text === null;
    } });
  }

  // Three lines while God mode and infiniteCasting are on, else null.
  #godNoticeText() {
    const god = this.#config.debug?.godMode;
    if (!god?.enabled || !god.infiniteCasting) return null;
    const line = god.infiniteCastingLine || {};
    const speed = Number(line.poleRetrieveSpeedMetersPerSec) || 0;
    const share = Math.round((Number(line.poleMinEfficiency) || 0) * 100);
    return [
      `Котушка: у боротьбі запас ліски ${Number(line.reserveMeters) || 0} м — риба, що клюнула далі за ліску снасті, ` +
        "лишається на своїй відстані; далі — звичайний фрикціон і підмотка.",
      "Махова вудка (без котушки): ліска понад її власну — віртуальна. Поки не тягнете, риба її витягує; поки тягнете — " +
        `ВІРТУАЛЬНА ПІДМОТКА ${speed} м/с (під натягом повільніше, не нижче ${share} % швидкості).`,
      "Віртуальна підмотка не скорочує ліску махової коротше за її власну довжину; далі — звичайна боротьба махової.",
    ];
  }
}
