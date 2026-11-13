import { ZoneEditorSection } from "../zone_editor_section.js";

// The location editor «🗺️ РЕДАКТОР» as a panel module (spec 174 B3): its section is created on each draw and the
// previous one disposed with its draft kept; the location's zone and perspective resets live here (moved from DevTools).
export class ZoneEditorModule {
  #options;
  #config;
  #configRuntime;
  #section = null;

  // options: what ZoneEditorSection takes from the composition (state, files, maskEditor, zoneDrawing, fullscreen,
  // readDynamicZones, getDependentZones, getWaterMetric, createWaterMetric, gameVersion); configRuntime: the override
  // store (resets and the code's zones) or null.
  constructor({ config, configRuntime = null, ...options }) {
    this.#config = config;
    this.#configRuntime = configRuntime;
    this.#options = options;
  }

  mount(host, { ui, createSection, tree, edits }) {
    this.#section?.dispose({ preserveDraft: true });
    const runtime = this.#configRuntime;
    this.#section = new ZoneEditorSection({
      ...this.#options,
      ui,
      config: this.#config,
      createSection: (label, parent, path) => createSection(label, parent, path),
      renderTree: (value, parent, path) => tree.render(value, parent, path),
      updateConfig: (path, value) => edits.update(path, value),
      resetPerspective: (id) => this.#resetPerspective(id, ui, edits),
      getBaseZones: (id) => runtime?.baseConfig.locations.map[id]?.zones ?? null,
      // Spec 130 D5: drops the session's overrides of a location's zones, so they are the code's again.
      resetZones: runtime ? (id) => {
        edits.resetOverrideTree(["locations", "map", id, "zones"]);
        console.log(`[DevTools] Зони ${id} скинуто до коду`);
      } : null,
    });
    this.#section.render(host);
  }

  dispose() {
    this.#section?.dispose();
    this.#section = null;
  }

  // Restores this location's waterProjection and drops exported overrides of the branches spec 126 retired, so they
  // are neither saved nor exported again (they never reach the metric).
  #resetPerspective(id, ui, edits) {
    const runtime = this.#configRuntime;
    const location = ["locations", "map", id];
    const retired = ["perspective", "distanceProfile"].map((branch) => [...location, branch].join("."));
    for (const key of Object.keys(runtime?.exportOverrides() || {})) {
      if (retired.some((prefix) => key === prefix || key.startsWith(prefix + "."))) runtime.reset(key);
    }
    const path = ["CONFIG", ...location, "waterProjection"];
    const initial = runtime?.baseConfig.locations.map[id]?.waterProjection;
    if (initial === undefined) {
      if (this.#config.locations.map[id]?.waterProjection !== undefined) runtime?.reset(path);
      return;
    }
    edits.update(path, initial);
    for (const [key, value] of Object.entries(this.#config.locations.map[id].waterProjection || {})) {
      ui.syncValue([...path, key], value);
    }
  }
}
