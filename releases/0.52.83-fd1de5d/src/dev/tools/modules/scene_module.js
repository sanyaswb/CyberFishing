import { SceneLayerDevSection } from "../scene_layer_dev_section.js";
import { WeatherDevSection } from "../weather_dev_section.js";
import { GENERAL_WEATHER_PART_IDS, GENERAL_WEATHER_PARTS } from "../../weather/weather_export_format.js";

const readPath = (object, path) => path.reduce((value, key) => value?.[key], object) ?? null;

// «СЦЕНА WebGL» with «ПОГОДА» inside it (TK-291) as a panel module (spec 174 B3, moved from DevTools). Without a
// scene section the weather section stands in the panel on its own. A redraw disposes the previous weather section.
export class SceneModule {
  #config;
  #configRuntime;
  #scene;
  #weather;
  #files;
  #gameVersion;
  #weatherSection = null;
  // TK-333.2: the weather selector's choice ({ selected, lastLocation }), kept while the panel closes and opens.
  #weatherView = {};

  // scene: the WebGL scene's DEV port or null; weather: the weather's DEV port or null; files: the browser file port.
  constructor({ config, configRuntime = null, scene = null, weather = null, files = null, gameVersion = "" }) {
    this.#config = config;
    this.#configRuntime = configRuntime;
    this.#scene = scene;
    this.#weather = weather;
    this.#files = files;
    this.#gameVersion = gameVersion;
  }

  mount(host, context) {
    this.dispose();
    if (!this.#scene) {
      this.#renderWeather(host, context);
      return;
    }
    const { ui, createSection, tree } = context;
    new SceneLayerDevSection({
      ui,
      scene: this.#scene,
      createSection,
      renderWeather: (parent) => this.#renderWeather(parent, context),
    }).render(host);
  }

  dispose() {
    this.#weatherSection?.dispose();
    this.#weatherSection = null;
  }

  // TK-360: the weather's switches follow the live state.
  refreshLive() {
    this.#weatherSection?.refreshLive();
  }

  #renderWeather(parent, { ui, createSection, tree, edits, closeOnPhone }) {
    if (!this.#weather) return;
    this.#weatherSection?.dispose();
    const config = this.#config, base = this.#configRuntime?.baseConfig;
    const locationId = this.#weather.locationId;
    this.#weatherSection = new WeatherDevSection({
      ui,
      weather: this.#weather,
      config: () => config.locations?.map?.[locationId]?.weather ?? null,
      locationConfig: (id) => config.locations?.map?.[id]?.weather ?? null,
      locationsMap: () => config.locations?.map ?? null,
      rainConfig: () => config.canvas?.rain ?? null,
      ashConfig: () => config.canvas?.ash ?? null,
      // Spec 180 D3/D4: the general settings the sections show with «Загальні».
      general: () => ({ rain: config.canvas?.rain ?? null, ash: config.canvas?.ash ?? null, water: config.canvas?.water ?? null,
        storm: config.weather?.storm ?? null, wind: config.weather?.wind ?? null, screen: config.emission?.screen ?? null,
        grain: config.canvas?.radiationGrain ?? null, geiger: config.ui?.audio?.geiger ?? null,
        starfall: config.canvas?.starfall ?? null, lightning: config.canvas?.lightning ?? null,
        debug: config.debug ?? null }),
      // Spec 180 D8: a section's «змінено» mark and its reset to the code.
      edits: this.#configRuntime ? {
        hasOverrides: (parts) => edits.hasOverridesUnder(parts),
        resetTree: (parts) => edits.resetOverrideTree(parts),
        isOverridden: (path) => edits.isOverridden(path),
        resetParameter: (path) => edits.resetParameter(path),
      } : null,
      createSection,
      renderConfigTree: (value, section, path, options) => tree.render(value, section, path, options),
      updateConfig: (path, value) => edits.update(path, value),
      files: this.#files,
      // Spec 180 stage D (TK-332): the general weather parts as in the code (status, export hashes, import templates).
      getBaseGeneral: () => (base ? Object.fromEntries(GENERAL_WEATHER_PART_IDS.map((part) =>
        [part, readPath(base, GENERAL_WEATHER_PARTS[part].configPath)])) : null),
      getBaseLocationWeather: (id) => base?.locations?.map?.[id]?.weather ?? null,
      // Spec 175 TK-286, spec 180 stage D: drops the session's overrides of the general parts and / or a location's weather.
      resetWeather: this.#configRuntime ? ({ general, locationId }) => {
        if (general) for (const part of GENERAL_WEATHER_PART_IDS) edits.resetOverrideTree([...GENERAL_WEATHER_PARTS[part].configPath]);
        if (locationId) edits.resetOverrideTree(["locations", "map", locationId, "weather"]);
        console.log(`[DevTools] Погоду ${[general ? "загальні" : null, locationId].filter(Boolean).join(" і ")} скинуто до коду`);
      } : null,
      gameVersion: this.#gameVersion,
      view: this.#weatherView,
      closeOnPhone,
    });
    this.#weatherSection.render(parent);
  }
}
