import { OVERLAY_MODULE_GROUPS, OVERLAY_MODULE_LABELS } from "../../overlay/config/overlay_modules_config.js";

// «OVERLAY» (spec 174 B3, moved from DevTools): the CONFIG.debug.overlay* parameters and one switch per overlay module
// (in its group), live through the overlay settings store; a module switched elsewhere shows here at once.
export class OverlaySettingsModule {
  #config;
  #settingsStore;
  #unsubscribe = null;
  #syncValue = null;

  // settingsStore: the overlay modules' settings (OverlaySettingsStore), or null on a page without the overlay.
  // TK-395 (spec 186 D5): the store's own methods, no fallbacks for ones it always has.
  constructor({ config, settingsStore = null }) {
    this.#config = config;
    this.#settingsStore = settingsStore;
    this.#unsubscribe = settingsStore
      ? settingsStore.subscribe((key, enabled) => this.#syncValue?.(["OVERLAY_MODULES", key], enabled))
      : null;
  }

  mount(host, { ui, createSection, tree }) {
    this.#syncValue = (path, value) => ui.syncValue(path, value);
    const overlayContent = createSection("OVERLAY", host, ["OVERLAY"], { icon: "layers" });
    for (const key of Object.keys(this.#config.debug || {}).filter((name) => name.startsWith("overlay"))) {
      const path = ["CONFIG", "debug", key];
      tree.renderScalar({ key: key === "overlay" ? "enabled" : key, value: this.#config.debug[key],
        parentElement: overlayContent, displayPath: path, canonicalPath: path });
    }
    const store = this.#settingsStore;
    const keys = store ? store.keys() : [];
    if (keys.length === 0) return;
    const content = createSection("OVERLAY MODULES (В live time)", overlayContent, ["OVERLAY_MODULES"]);
    const rendered = new Set();
    const renderSwitch = (key, parent) => {
      if (!keys.includes(key) || rendered.has(key)) return;
      rendered.add(key);
      ui.createSwitcherRow(OVERLAY_MODULE_LABELS[key]?.label || key, store.isEnabled(key), parent,
        (value) => store.setEnabled(key, value), ["OVERLAY_MODULES", key]);
    };
    for (const group of OVERLAY_MODULE_GROUPS) {
      const visible = (group.keys || []).filter((key) => keys.includes(key));
      if (visible.length === 0) continue;
      const groupContent = createSection(group.label || "Overlay group", content,
        ["OVERLAY_MODULES", group.label || "group"]);
      for (const key of visible) renderSwitch(key, groupContent);
    }
    for (const key of keys) renderSwitch(key, content);
  }

  dispose() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#syncValue = null;
  }
}
