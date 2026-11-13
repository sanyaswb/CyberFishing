// The asset load plan (spec 157 R15, TK-177): layers in order, each with groups by priority (1 first); a group names its
// assets by registry id ({ id }), by tag ({ tag }: every asset carrying it) or by a named source of game state
// ({ source }: a function of the startup state that returns ids), or names a code module ({ module }: a feature the
// composition loads with import() after the first frame or on first use, spec 157 R12). Pure: no browser, no game.
// - A layer starts on "composition" (with the game's composition), "ready" (the first frame) or "after:<layer>".
// - A group with load: false is placed but loads only on demand (large content opened later: audio, the House, fish).
// - A group with readyOn: "low" counts as loaded once the low-quality copies of its images have (spec 157 R17); the
//   full files follow after the first frame, unless the group says upgrade: "on-demand" (spec 166: the rod's start
//   picture, whose full file only a rod without Spine asks for).
// - A layer with lazy: true runs twice over its groups in order: the low-quality copies (with the files that have no
//   copy), then the full files (spec 159).
// - A group with locked: true names what game progress has not opened yet (by a source): it loads nothing, and the lazy
//   layer leaves those assets out until they open.
// - An asset belongs to the first group (layer, then priority) that names it; an explicit { id } in two groups is an
//   error. Registry assets no group names are the implicit last group "unassigned" of the last layer.
const ENTRY_KEYS = Object.freeze(["id", "tag", "source", "module"]);
const STARTS = /^(?:composition|ready|after:[a-z0-9-]+)$/u;
export const UNASSIGNED_GROUP_ID = "unassigned";

export class AssetLoadPlan {
  #layers;
  #registry;
  #sources;
  #unassigned;

  // plan: { layers: [{ id, label, start, groups: [{ id, label, priority, load, assets: [entry] }] }] };
  // registry: AssetRegistry; sources: { name: { resolve(state) -> ids, candidates() -> every id it may return } };
  // modules: the module names the composition can load, or null (a tool that only reads the plan's assets).
  constructor({ plan, registry, sources = {}, modules = null }) {
    const errors = AssetLoadPlan.validate({ plan, registry, sources, modules });
    if (errors.length > 0) throw new Error(`Invalid asset load plan:\n${errors.join("\n")}`);
    this.#registry = registry;
    this.#sources = sources;
    this.#layers = plan.layers.map((layer) => Object.freeze({
      id: layer.id, label: layer.label ?? layer.id, start: layer.start, lazy: layer.lazy === true,
      groups: Object.freeze([...layer.groups].sort((a, b) => a.priority - b.priority).map((group) => Object.freeze({
        id: group.id, label: group.label ?? group.id, priority: group.priority, load: group.load !== false && group.locked !== true,
        locked: group.locked === true, readyOn: group.readyOn ?? "full", upgrade: group.upgrade ?? "auto",
        assets: Object.freeze([...group.assets]),
      }))),
    }));
    const unassigned = this.#coverGaps();
    this.#unassigned = Object.freeze(unassigned);
    if (unassigned.length > 0) {
      const last = this.#layers[this.#layers.length - 1];
      const priority = Math.max(0, ...last.groups.map((group) => group.priority)) + 1;
      this.#layers[this.#layers.length - 1] = Object.freeze({ ...last, groups: Object.freeze([...last.groups,
        Object.freeze({ id: UNASSIGNED_GROUP_ID, label: UNASSIGNED_GROUP_ID, priority, load: true, locked: false,
          assets: Object.freeze(unassigned.map((id) => Object.freeze({ id }))) })]) });
    }
  }

  // Every problem of a plan, as readable lines (empty when valid).
  static validate({ plan, registry, sources = {}, modules = null }) {
    const errors = [];
    if (!plan || !Array.isArray(plan.layers) || plan.layers.length === 0) return ["the plan needs layers"];
    const layerIds = new Set();
    const groupIds = new Set();
    const explicit = new Map();
    const moduleGroups = new Map();
    for (const layer of plan.layers) {
      if (!layer?.id || layerIds.has(layer.id)) errors.push(`layer "${layer?.id}" needs a unique id`);
      if (!STARTS.test(String(layer?.start))) errors.push(`layer ${layer?.id}: start must be composition, ready or after:<layer>`);
      if (String(layer?.start).startsWith("after:") && !layerIds.has(layer.start.slice(6))) {
        errors.push(`layer ${layer.id}: starts after an unknown or later layer ${layer.start.slice(6)}`);
      }
      layerIds.add(layer?.id);
      for (const group of layer?.groups ?? []) {
        const where = `${layer.id}/${group?.id}`;
        if (!group?.id || groupIds.has(group.id) || group.id === UNASSIGNED_GROUP_ID) errors.push(`group "${where}" needs a unique id`);
        groupIds.add(group?.id);
        if (!Number.isInteger(group?.priority) || group.priority < 1) errors.push(`${where}: priority must be an integer >= 1`);
        if (group?.locked === true && !group.assets?.every((entry) => entry.source)) errors.push(`${where}: a locked group names sources only`);
        if (group?.readyOn !== undefined && !["full", "low"].includes(group.readyOn)) errors.push(`${where}: readyOn must be full or low`);
        if (group?.upgrade !== undefined && (!["auto", "on-demand"].includes(group.upgrade) || group.readyOn !== "low")) {
          errors.push(`${where}: upgrade must be auto or on-demand, with readyOn low`);
        }
        if (!Array.isArray(group?.assets)) { errors.push(`${where}: assets must be a list`); continue; }
        for (const entry of group.assets) {
          const keys = Object.keys(entry ?? {}).filter((key) => ENTRY_KEYS.includes(key));
          if (keys.length !== 1 || Object.keys(entry).length !== 1) {
            errors.push(`${where}: an entry has exactly one of id, tag, source`);
          } else if (keys[0] === "id") {
            if (!registry.has(entry.id)) errors.push(`${where}: unknown asset id ${entry.id}`);
            if (explicit.has(entry.id)) errors.push(`${where}: ${entry.id} is also in ${explicit.get(entry.id)}`);
            explicit.set(entry.id, where);
          } else if (keys[0] === "module") {
            if (typeof entry.module !== "string" || !entry.module) errors.push(`${where}: a module entry needs a name`);
            else if (modules && !modules.includes(entry.module)) errors.push(`${where}: unknown module ${entry.module}`);
            if (moduleGroups.has(entry.module)) errors.push(`${where}: module ${entry.module} is also in ${moduleGroups.get(entry.module)}`);
            moduleGroups.set(entry.module, where);
          } else if (keys[0] === "tag") {
            if (registry.idsByTag(entry.tag).length === 0) errors.push(`${where}: tag ${entry.tag} matches no asset`);
          } else if (typeof sources[entry.source]?.resolve !== "function") {
            errors.push(`${where}: unknown source ${entry.source}`);
          }
        }
      }
    }
    return errors;
  }

  get layers() {
    return this.#layers;
  }

  layer(layerId) {
    const layer = this.#layers.find((candidate) => candidate.id === layerId);
    if (!layer) throw new RangeError(`Unknown asset load plan layer "${layerId}"`);
    return layer;
  }

  // The ids of a group for the given startup state, in entry order, without repeats.
  resolveGroup(group, state = {}) {
    const ids = [];
    for (const entry of group.assets) {
      if (entry.id) ids.push(entry.id);
      else if (entry.tag) ids.push(...this.#registry.idsByTag(entry.tag));
      else if (entry.source) ids.push(...this.#sources[entry.source].resolve(state));
    }
    return [...new Set(ids)];
  }

  // Every asset that game progress keeps closed for the given state.
  lockedIds(state = {}) {
    return this.#layers.flatMap((layer) => layer.groups).filter((group) => group.locked)
      .flatMap((group) => this.resolveGroup(group, state));
  }

  // The code modules a group names, in entry order.
  modulesOf(group) {
    return group.assets.filter((entry) => entry.module).map((entry) => entry.module);
  }

  // Registry assets that no group of the configured plan names (and no source can return).
  unassignedIds() {
    return [...this.#unassigned];
  }

  #coverGaps() {
    const covered = new Set();
    for (const layer of this.#layers) {
      for (const group of layer.groups) {
        for (const entry of group.assets) {
          if (entry.id) covered.add(entry.id);
          else if (entry.tag) for (const id of this.#registry.idsByTag(entry.tag)) covered.add(id);
          else if (entry.source) for (const id of this.#sources[entry.source].candidates()) covered.add(id);
        }
      }
    }
    return this.#registry.ids().filter((id) => !covered.has(id));
  }
}
