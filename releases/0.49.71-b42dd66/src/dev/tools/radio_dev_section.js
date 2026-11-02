import { RADIO_SOUND_SETTINGS } from "../../game/config/raw/radio/radio_sound_settings.js";
import { buildSettingsFile, pickSettings, settingsFileName, settingsHash } from "../radio/radio_sound_settings_format.js";

// DevTools «📻 РАДІО» (spec 142 stage 5, TK-097, TK-099): the radio's status (power, station, country, stations,
// signal, the battery's charge), discharging its battery to 20 / 5 / 0 % through the ordinary consumption path (DEV
// never raises a charge: a new battery comes from the free shop), the sound parts (vinyl, walkie-talkie, the signal's
// interference: each with its «увімкнено» switch; a part that is off hides its parameters, edited live), the export of
// the sound settings for `npm run apply:radio`, and the other CONFIG.radio values. The player has no sound controls.
const PARTS = Object.freeze([
  Object.freeze({ key: "retro", label: "Ретро", path: Object.freeze(["effects", "retro"]) }),
  Object.freeze({ key: "vinyl", label: "Платівка", path: Object.freeze(["effects", "vinyl"]) }),
  Object.freeze({ key: "radio", label: "Радіо", path: Object.freeze(["effects", "radio"]) }),
  Object.freeze({ key: "walkieTalkie", label: "Рація", path: Object.freeze(["effects", "walkieTalkie"]) }),
  Object.freeze({ key: "signal", label: "Перешкоди сигналу", path: Object.freeze(["signal"]) }),
  Object.freeze({ key: "weather", label: "Погодні перешкоди", path: Object.freeze(["signal", "weather"]) }),
]);

export class RadioDevSection {
  #ui;
  #radio;
  #config;
  #createSection;
  #renderConfigTree;
  #setConfig;
  #files;
  #gameVersion;
  #now;
  #content = null;

  // radio: { getStatus(), batteryPercent(), discharge(percent) }; config: () => CONFIG.radio; createSection(label,
  // parent, path), renderConfigTree(value, parent, path, options) and setConfig(path, value) come from DevTools;
  // files: { download(name, text), hashText(text) } (the zone editor's browser port).
  constructor({ ui, radio, config, createSection, renderConfigTree, setConfig, files = null, gameVersion = "",
    now = () => new Date() }) {
    this.#ui = ui;
    this.#radio = radio;
    this.#config = config;
    this.#createSection = createSection;
    this.#renderConfigTree = renderConfigTree;
    this.#setConfig = setConfig;
    this.#files = files;
    this.#gameVersion = gameVersion;
    this.#now = now;
  }

  render(parent) {
    this.#content = this.#createSection("📻 РАДІО", parent, ["RADIO"]);
    this.#fill();
  }

  // The sound settings file: the live values, the code's hash (a conflict check for apply:radio), the game version.
  async exportSettings() {
    if (!this.#files) return null;
    const hashText = (text) => this.#files.hashText(text);
    const file = buildSettingsFile({ settings: pickSettings(this.#config()), gameVersion: this.#gameVersion,
      baseHash: await settingsHash(RADIO_SOUND_SETTINGS, hashText), exportedAt: this.#now().toISOString() });
    const name = settingsFileName(this.#gameVersion, this.#now());
    this.#files.download(name, `${JSON.stringify(file, null, 2)}\n`);
    return name;
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
    this.#renderParts(content);
    if (this.#files) {
      this.#ui.createButtonRow("⬇ Експорт налаштувань звуку (npm run apply:radio)", content, () => {
        this.exportSettings().catch(() => {});
      });
    }
    const config = this.#config() || {};
    this.#renderConfigTree(config, this.#createSection("Параметри (CONFIG.radio)", content, ["RADIO", "config"]),
      ["CONFIG", "radio"], { visibilityPolicy: { isVisible: (path) =>
        !(path.length === 3 && (path[2] === "effects" || path[2] === "signal")) } });
  }

  #renderParts(parent) {
    const parts = this.#createSection("Звук: ефекти й перешкоди", parent, ["RADIO", "effects"]);
    const config = this.#config() || {};
    for (const { key, label, path } of PARTS) {
      let settings = config;
      for (const part of path) settings = settings?.[part];
      const section = this.#createSection(label, parts, ["RADIO", "effects", key]);
      const configPath = ["CONFIG", "radio", ...path];
      this.#ui.createSwitcherRow("увімкнено", settings?.enabled === true, section, (enabled) => {
        this.#setConfig([...configPath, "enabled"], enabled);
        this.#fill();
      }, ["RADIO", "effects", key, "enabled"]);
      if (settings?.enabled !== true) continue;
      this.#renderConfigTree(settings, section, configPath,
        { visibilityPolicy: { isVisible: (entryPath) => entryPath[entryPath.length - 1] !== "enabled" } });
    }
  }
}
