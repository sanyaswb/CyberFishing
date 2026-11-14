const STORAGE_KEY = "dev_tools_panel_settings";
const DEFAULTS = Object.freeze({ adaptiveWidth: false, fullscreen: false, side: "left" });
const SIDES = Object.freeze([Object.freeze({ value: "left", label: "Ліворуч" }), Object.freeze({ value: "right", label: "Праворуч" })]);

// «Панель» (TK-312, owner 2026-11-14): settings of the DevTools panel itself, the last module on the rail.
//   adaptiveWidth — on a computer the panel is as wide as its content (within limits) instead of a fixed width;
//   fullscreen    — on a landscape phone the panel takes the whole screen instead of a side panel (a portrait phone
//                   always shows it full screen, TK-313);
//   side          — the edge the side panel opens from on a computer and a landscape phone: "left" | "right" (TK-317).
// Both are remembered (a DEV convenience in the browser's storage) and applied by DevToolsUI.setPanelOptions.
export class PanelSettingsModule {
  #storageCache;
  #apply;
  #options;

  // apply(options): DevToolsUI.setPanelOptions.
  constructor({ storageCache, apply }) {
    this.#storageCache = storageCache;
    this.#apply = apply;
    const stored = storageCache.get(STORAGE_KEY, {});
    this.#options = { ...DEFAULTS, ...(stored && typeof stored === "object" ? stored : {}) };
    this.#apply(this.#options);
  }

  get options() {
    return { ...this.#options };
  }

  mount(host, { ui, createSection }) {
    const content = createSection("ПАНЕЛЬ", host, ["PANEL"], { icon: "gear" });
    ui.addParameter(content, { control: "switch", label: "Адаптивна ширина (ПК)", value: this.#options.adaptiveWidth,
      path: ["PANEL", "adaptiveWidth"], onCommit: (value) => this.#set("adaptiveWidth", value) });
    ui.addParameter(content, { control: "switch", label: "На весь екран (телефон горизонтально)", value: this.#options.fullscreen,
      path: ["PANEL", "fullscreen"], onCommit: (value) => this.#set("fullscreen", value) });
    ui.addParameter(content, { control: "segments", label: "Сторона (ПК, горизонтально)", value: this.#options.side,
      options: SIDES, path: ["PANEL", "side"], onCommit: (value) => this.#set("side", value) });
  }

  #set(key, value) {
    const next = key === "side" ? (value === "right" ? "right" : "left") : value === true;
    this.#options = { ...this.#options, [key]: next };
    this.#storageCache.set(STORAGE_KEY, this.#options);
    this.#apply(this.#options);
  }
}
