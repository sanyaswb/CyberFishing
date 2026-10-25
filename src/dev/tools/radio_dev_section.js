// DevTools «📻 РАДІО» (spec 142 stage 5, TK-097): the radio's status (power, station, country, stations, signal, the
// battery's charge), discharging its battery to 20 / 5 / 0 % through the ordinary consumption path (DEV never raises a
// charge: a new battery comes from the free shop), the sound effects (each with its «увімкнено» switch; a disabled
// effect hides its parameters, edited live) and the other CONFIG.radio values. The player has no sound controls.
const EFFECTS = Object.freeze([
  Object.freeze({ key: "vinyl", label: "Платівка" }),
  Object.freeze({ key: "walkieTalkie", label: "Рація" }),
]);

export class RadioDevSection {
  #ui;
  #radio;
  #config;
  #createSection;
  #renderConfigTree;
  #setConfig;
  #content = null;

  // radio: { getStatus(), batteryPercent(), discharge(percent) }; config: () => CONFIG.radio; createSection(label,
  // parent, path), renderConfigTree(value, parent, path, options) and setConfig(path, value) come from DevTools.
  constructor({ ui, radio, config, createSection, renderConfigTree, setConfig }) {
    this.#ui = ui;
    this.#radio = radio;
    this.#config = config;
    this.#createSection = createSection;
    this.#renderConfigTree = renderConfigTree;
    this.#setConfig = setConfig;
  }

  render(parent) {
    this.#content = this.#createSection("📻 РАДІО", parent, ["RADIO"]);
    this.#fill();
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    content.replaceChildren();
    const status = this.#radio.getStatus();
    const charge = this.#radio.batteryPercent();
    this.#ui.createInfoRow("стан", `${status.powered ? "увімкнено" : "вимкнено"} · ${status.status}`, content);
    this.#ui.createInfoRow("станція", status.station?.name || "—", content);
    this.#ui.createInfoRow("країна · станцій", `${status.country} · ${status.stationCount}`, content);
    this.#ui.createInfoRow("сигнал", `${Math.round((status.signal ?? 1) * 100)}%`, content);
    this.#ui.createInfoRow("заряд батарейки", charge === null ? "немає батарейки" : `${charge.toFixed(1)}%`, content);
    this.#ui.createButtonRow("↻ Оновити", content, () => this.#fill());
    for (const target of [20, 5, 0]) {
      this.#ui.createButtonRow(`Розрядити до ${target}%`, content, () => {
        this.#radio.discharge(target);
        this.#fill();
      });
    }
    this.#renderEffects(content);
    const config = this.#config() || {};
    this.#renderConfigTree(config, this.#createSection("Параметри (CONFIG.radio)", content, ["RADIO", "config"]),
      ["CONFIG", "radio"], { visibilityPolicy: { isVisible: (path) => !(path.length === 3 && path[2] === "effects") } });
  }

  #renderEffects(parent) {
    const effects = this.#createSection("Звукові ефекти", parent, ["RADIO", "effects"]);
    const config = this.#config()?.effects || {};
    for (const { key, label } of EFFECTS) {
      const effect = config[key] || {};
      const section = this.#createSection(label, effects, ["RADIO", "effects", key]);
      const path = ["CONFIG", "radio", "effects", key];
      this.#ui.createSwitcherRow("увімкнено", effect.enabled === true, section, (enabled) => {
        this.#setConfig([...path, "enabled"], enabled);
        this.#fill();
      }, ["RADIO", "effects", key, "enabled"]);
      if (effect.enabled !== true) continue;
      this.#renderConfigTree(effect, section, path,
        { visibilityPolicy: { isVisible: (entryPath) => entryPath[entryPath.length - 1] !== "enabled" } });
    }
  }
}
