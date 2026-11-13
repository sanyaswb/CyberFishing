import { SceneLayerDevSection } from "../scene_layer_dev_section.js";
import { WeatherDevSection } from "../weather_dev_section.js";

// «🖼️ СЦЕНА WebGL» with «ПОГОДА» inside it (TK-291) as a panel module (spec 174 B3, moved from DevTools). Without a
// scene section the weather section stands in the panel on its own. A redraw disposes the previous weather section.
export class SceneModule {
  #config;
  #configRuntime;
  #scene;
  #weather;
  #files;
  #gameVersion;
  #weatherSection = null;

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
      createSection: (label, parent, path) => createSection(label, parent, path),
      renderWaterConfig: (parent) => tree.render(this.#config.canvas.water, parent, ["CONFIG", "canvas", "water"]),
      renderWeather: (parent) => this.#renderWeather(parent, context),
    }).render(host);
  }

  dispose() {
    this.#weatherSection?.dispose();
    this.#weatherSection = null;
  }

  #renderWeather(parent, { ui, createSection, tree, edits }) {
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
      createSection: (label, section, path) => createSection(label, section, path),
      renderConfigTree: (value, section, path, options) => tree.render(value, section, path, options),
      updateConfig: (path, value) => edits.update(path, value),
      files: this.#files,
      getBaseRain: () => base?.canvas?.rain ?? null,
      getBaseLocationWeather: (id) => base?.locations?.map?.[id]?.weather ?? null,
      // Spec 175 TK-286: drops the session's overrides of rain look and the location's weather.
      resetWeather: this.#configRuntime ? (id) => {
        edits.resetOverrideTree(["canvas", "rain"]);
        edits.resetOverrideTree(["locations", "map", id, "weather"]);
        console.log(`[DevTools] Погоду ${id} скинуто до коду`);
      } : null,
      gameVersion: this.#gameVersion,
    });
    this.#weatherSection.render(parent);
  }
}
