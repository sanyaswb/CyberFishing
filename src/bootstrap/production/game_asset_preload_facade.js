import { AssetLoadQueue } from "../../engine/assets/asset_load_queue.js";

// Runs the asset load plan (spec 157 R15, stages D1-D2): every image the plan loads goes into the game's one
// ImageAssetProvider under its asset id, so the renderers, the scene and the views find it by that id. A layer runs its
// groups by priority (the same priority in parallel, the next one when they have settled); a layer that starts
// "after:<layer>" follows that layer on its own. Loads never reject: a group settles { status, ids, error }.
// Every load goes through one AssetLoadQueue: the first layer is "blocking", the second "upgrade", later layers
// "prefetch" (background work, capped and paused while the conditions say so: hidden tab, offline, save-data), and
// request() — what the player opened — is "interactive": it overtakes the background and promotes a queued job.
// A lazy layer (spec 159) runs its groups twice: the low copies, then the full files; closed assets stay out until
// setProgress() opens them. Spine exports reach the browser's cache there through warmFile; on use they, like audio, stay
// with their own loaders. Code modules (spec 157
// R12: features loaded with import() after the first frame) go through the same queue: a plan group's { module } entries
// load at the layer's priority, loadModule() — the player's first use — as "interactive", one job per module.
const LAYER_PRIORITIES = Object.freeze(["blocking", "upgrade"]);

export class GameAssetPreloadFacade {
  #plan;
  #assets;
  #images;
  #queue;
  #unsubscribeConditions = null;
  #state = {};
  #layerRuns = new Map();
  #groupOutcomes = new Map();
  #groupWaiters = new Map();
  // Images shown from their low copy (readyOn "low"), upgraded to the full file when the next layer starts.
  #upgrades = [];
  #now;
  #groupTimes = new Map();
  #moduleLoaders;
  #modules = new Map();
  #moduleWaiters = new Map();
  #warmFile;
  #lockedIds = new Set();
  // Images loaded in full, and images whose store entry is still only the low copy.
  #fullIds = new Set();
  #lowOnlyIds = new Set();
  #settledLayers = new Set();
  // The first layer's full files replacing its copies: no layer run waits for them.
  #upgradeRuns = [];
  #spineAvailable;
  #fullLoad;

  // plan: AssetLoadPlan; assets: AssetRegistry; imageAssets: the game's ImageAssetProvider; scheduler: { setTimeout,
  // clearTimeout } (retries); conditions: { isPaused(), subscribe(listener) } or null (never paused).
  // networkSlots: the start's first layer (16 images today) must not queue behind a small cap over HTTP/2 (measured:
  // 6 slots cost 0.1 s and a request wave on Fast 4G); backgroundSlots caps the later layers.
  // now(): milliseconds for the DEV overlay's group times (performance.now), or null.
  // modules: { name: () => Promise<module> } — the composition's import() of each feature the plan names.
  // warmFile: (path) => Promise — puts a file in the browser's cache, or null (the lazy layer then skips those kinds).
  // spineAvailable: () => Promise<boolean> — whether this page can play Spine (spec 166); without Spine the lazy layer
  // warms no Spine export. null: always warm.
  constructor({ plan, assets, imageAssets, scheduler, conditions = null, networkSlots = 24, backgroundSlots = 4,
    maxAttempts = 2, now = null, modules = {}, warmFile = null, spineAvailable = null }) {
    this.#warmFile = warmFile;
    this.#spineAvailable = spineAvailable;
    this.#moduleLoaders = modules;
    this.#now = typeof now === "function" ? now : null;
    if (typeof plan?.resolveGroup !== "function") throw new TypeError("GameAssetPreloadFacade requires a plan");
    if (typeof assets?.pathOf !== "function") throw new TypeError("GameAssetPreloadFacade requires assets");
    if (typeof imageAssets?.preload !== "function") throw new TypeError("GameAssetPreloadFacade requires imageAssets");
    this.#plan = plan;
    this.#assets = assets;
    this.#images = imageAssets;
    this.#fullLoad = {};
    this.#fullLoad.promise = new Promise((resolve) => { this.#fullLoad.resolve = resolve; });
    this.#queue = new AssetLoadQueue({ scheduler, networkSlots, speculativeSlots: backgroundSlots, maxAttempts });
    if (conditions) {
      this.#queue.setSpeculativeAllowed(!conditions.isPaused());
      this.#unsubscribeConditions = conditions.subscribe((paused) => this.#queue.setSpeculativeAllowed(!paused));
    }
  }

  // Starts a layer once; state (the startup state for the plan's sources) is merged into what earlier layers gave.
  start(layerId, state = {}) {
    if (this.#layerRuns.has(layerId)) return this.#layerRuns.get(layerId);
    Object.assign(this.#state, state);
    this.#lockedIds = new Set(this.#plan.lockedIds(this.#state));
    const index = this.#plan.layers.findIndex((layer) => layer.id === layerId);
    if (index > 0 && this.#upgrades.length > 0) {
      const upgrades = this.#upgrades.splice(0);
      this.#upgradeRuns.push(this.#loadIds(upgrades, "upgrade"));
    }
    const layer = this.#plan.layer(layerId);
    const priority = LAYER_PRIORITIES[index] ?? "prefetch";
    const run = layer.lazy ? this.#runLazyLayer(layer, priority) : this.#runLayer(layer, priority);
    this.#layerRuns.set(layerId, run);
    run.then(() => {
      for (const layer of this.#plan.layers) if (layer.start === `after:${layerId}`) this.start(layer.id);
      this.#settledLayers.add(layerId);
      if (this.#settledLayers.size === this.#plan.layers.length) {
        void Promise.all(this.#upgradeRuns).then(() => this.#fullLoad.resolve());
      }
    });
    return run;
  }

  // Settles when every layer has settled and the first layer's copies have been replaced (T-full, TK-214). Failed loads
  // settle too; what progress keeps closed, on-demand groups and what the player opens later are not waited for.
  whenFullyLoaded() {
    return this.#fullLoad.promise;
  }

  // Game progress changed: what it opened joins the background at once (low copy, then the full file).
  async setProgress(state) {
    Object.assign(this.#state, state);
    const next = new Set(this.#plan.lockedIds(this.#state));
    const opened = [...this.#lockedIds].filter((id) => !next.has(id));
    this.#lockedIds = next;
    if (opened.length === 0 || !this.#plan.layers.some((layer) => layer.lazy && this.#layerRuns.has(layer.id))) return;
    for (const group of this.#plan.layers.flatMap((layer) => layer.groups)) {
      if (group.locked && this.#groupOutcomes.has(group.id)) {
        this.#settleGroup(group, { status: "locked", ids: this.#plan.resolveGroup(group, this.#state), error: null });
      }
    }
    await this.#loadIds(opened, "prefetch", { low: true });
    await this.#loadIds(opened, "prefetch");
  }

  // Starts every layer whose start is the trigger ("composition", "ready").
  startOn(trigger, state = {}) {
    return Promise.all(this.#plan.layers.filter((layer) => layer.start === trigger).map((layer) => this.start(layer.id, state)));
  }

  whenLayer(layerId) {
    return this.#layerRuns.get(layerId) ?? Promise.reject(new Error(`Asset load plan layer ${layerId} has not started`));
  }

  // Settles with the group's outcome once its layer has loaded it (or placed it, for an on-demand group).
  whenGroup(groupId) {
    if (this.#groupOutcomes.has(groupId)) return Promise.resolve(this.#groupOutcomes.get(groupId));
    if (!this.#groupWaiters.has(groupId)) {
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      this.#groupWaiters.set(groupId, { promise, resolve });
    }
    return this.#groupWaiters.get(groupId).promise;
  }

  // Images by asset id that an open view needs now: "interactive", ahead of the background, never paused.
  // Settles { status: ready|failed, ids, error }.
  async request(ids) {
    return this.#loadIds(ids, "interactive");
  }

  // A feature module the player needs now: "interactive", ahead of the background (a queued prefetch of the same module
  // is promoted, not repeated). Settles { status: ready|failed, module, error }.
  loadModule(name) {
    return this.#loadModule(name, "interactive");
  }

  // Settles with the module once it has loaded, by the plan or by loadModule().
  whenModule(name) {
    if (this.#modules.has(name)) return Promise.resolve(this.#modules.get(name));
    if (!this.#moduleWaiters.has(name)) {
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      this.#moduleWaiters.set(name, { promise, resolve });
    }
    return this.#moduleWaiters.get(name).promise;
  }

  // Whether an image has loaded into the game's image store (a view can show it at once, without its low copy).
  isReady(id) {
    return this.#images.isReady?.(id) === true && !this.#lowOnlyIds.has(id);
  }

  getQueueSnapshot() {
    return this.#queue.getSnapshot();
  }

  dispose() {
    this.#unsubscribeConditions?.();
    this.#unsubscribeConditions = null;
    this.#queue.dispose();
  }

  // For the DEV overlay: every layer and group with its state and ids.
  getStatus() {
    return this.#plan.layers.map((layer) => ({
      id: layer.id, label: layer.label, started: this.#layerRuns.has(layer.id),
      groups: layer.groups.map((group) => ({ id: group.id, label: group.label, priority: group.priority, load: group.load, locked: group.locked,
        readyOn: group.readyOn, modules: this.#plan.modulesOf(group), status: this.#groupOutcomes.get(group.id)?.status
          ?? (this.#groupTimes.has(group.id) ? "loading" : "waiting"),
        ids: this.#groupOutcomes.get(group.id)?.ids ?? [], ...(this.#groupTimes.get(group.id) ?? {}) })),
    }));
  }

  async #runLayer(layer, priority) {
    const priorities = [...new Set(layer.groups.map((group) => group.priority))];
    for (const groupPriority of priorities) {
      await Promise.all(layer.groups.filter((group) => group.priority === groupPriority)
        .map((group) => this.#loadGroup(group, priority)));
    }
  }

  // A lazy layer: the low pass over its groups in order, then the full pass in the same order (spec 159).
  async #runLazyLayer(layer, priority) {
    const groups = layer.groups.filter((group) => {
      if (group.load) return true;
      this.#settleGroup(group, { status: group.locked ? "locked" : "on-demand", ids: this.#plan.resolveGroup(group, this.#state), error: null });
      return false;
    });
    const priorities = [...new Set(groups.map((group) => group.priority))];
    const pass = async (step) => {
      for (const groupPriority of priorities) {
        await Promise.all(groups.filter((group) => group.priority === groupPriority).map((group) => step(group)));
      }
    };
    const outcomes = new Map();
    await pass(async (group) => {
      this.#groupTimes.set(group.id, { startedMs: this.#now?.() ?? null, settledMs: null });
      const ids = this.#openIds(group);
      const results = [await this.#loadIds(ids, priority, { low: true }), await this.#warm(this.#spineIds(ids), priority, "low")];
      for (const name of this.#plan.modulesOf(group)) results.push(await this.#loadModule(name, priority));
      outcomes.set(group.id, results);
    });
    await pass(async (group) => {
      const ids = this.#openIds(group);
      const results = [...outcomes.get(group.id), await this.#loadIds(ids.filter((id) => this.#hasLow(id)), priority),
        await this.#warm(this.#spineIds(ids), priority, "full")];
      const failed = results.find((result) => result.status === "failed");
      this.#groupTimes.get(group.id).settledMs = this.#now?.() ?? null;
      this.#settleGroup(group, { status: failed ? "failed" : "ready", ids, error: failed?.error ?? null });
    });
  }

  #openIds(group) {
    return this.#plan.resolveGroup(group, this.#state).filter((id) => !this.#lockedIds.has(id));
  }

  #hasLow(id) {
    return this.#assets.entryOf(id).kind === "image" && Boolean(this.#assets.lowPathOf(id));
  }

  #spineIds(ids) {
    return ids.filter((id) => this.#assets.entryOf(id).kind === "spine");
  }

  // Spine exports: into the browser's cache through the queue, so the background still yields to the player. Spec 166:
  // only where Spine plays; the low pass takes the skeleton, the atlas and the half-size pages (the full pages where an
  // export has no copies), the full pass the full pages.
  async #warm(ids, priority, pass) {
    if (!this.#warmFile || ids.length === 0) return { status: "ready", ids, error: null };
    if (this.#spineAvailable && await this.#spineAvailable() !== true) return { status: "ready", ids, error: null };
    const paths = ids.flatMap((id) => {
      const { skeleton, atlas, textures, lowTextures } = this.#assets.spineOf(id);
      if (pass === "full") return lowTextures ? textures : [];
      return [skeleton, atlas, ...(lowTextures ?? textures)];
    });
    const results = await Promise.all(paths.map((path) => this.#queue.request({ key: `file:${path}`, priority,
      load: () => this.#warmFile(path) }).result));
    const failed = results.find((result) => result.status !== "ready");
    return { status: failed ? "failed" : "ready", ids, error: failed ? failed.error ?? new Error(failed.status) : null };
  }

  #settleGroup(group, outcome) {
    this.#groupOutcomes.set(group.id, outcome);
    this.#groupWaiters.get(group.id)?.resolve(outcome);
  }

  // low: load the low-quality copy (where an image has one) under the image's own id; the full file replaces it later.
  async #loadIds(ids, priority, { low = false } = {}) {
    const targets = this.#imageIds(ids).filter((id) => !(low && this.#fullIds.has(id)));
    const results = await Promise.all(targets.map((id) => {
      const lowPath = low ? this.#assets.lowPathOf(id) : null;
      return this.#queue.request({ key: lowPath ? `${id}#low` : id, priority,
        load: () => this.#images.preload([{ id, src: lowPath ?? this.#assets.pathOf(id) }]) }).result.then((result) => {
        if (result.status === "ready") {
          if (lowPath) { if (!this.#fullIds.has(id)) this.#lowOnlyIds.add(id); }
          else { this.#fullIds.add(id); this.#lowOnlyIds.delete(id); }
        }
        return result;
      });
    }));
    const failed = results.find((result) => result.status !== "ready");
    return { status: failed ? "failed" : "ready", ids, error: failed ? failed.error ?? new Error(failed.status) : null };
  }

  async #loadModule(name, priority) {
    const load = this.#moduleLoaders[name];
    if (typeof load !== "function") return { status: "failed", module: null, error: new Error(`Unknown module ${name}`) };
    if (this.#modules.has(name)) return { status: "ready", module: this.#modules.get(name), error: null };
    const result = await this.#queue.request({ key: `module:${name}`, priority, load: () => load() }).result;
    if (result.status !== "ready") return { status: "failed", module: null, error: result.error ?? new Error(result.status) };
    if (!this.#modules.has(name)) {
      this.#modules.set(name, result.payload);
      this.#moduleWaiters.get(name)?.resolve(result.payload);
    }
    return { status: "ready", module: this.#modules.get(name), error: null };
  }

  async #loadGroup(group, priority) {
    const ids = this.#plan.resolveGroup(group, this.#state);
    const times = { startedMs: this.#now?.() ?? null, settledMs: null };
    this.#groupTimes.set(group.id, times);
    const low = group.readyOn === "low";
    const outcome = group.load ? await this.#loadIds(ids, priority, { low }) : { status: "on-demand", ids, error: null };
    if (group.load) {
      for (const name of this.#plan.modulesOf(group)) {
        const loaded = await this.#loadModule(name, priority);
        if (loaded.status !== "ready" && outcome.status === "ready") Object.assign(outcome, { status: "failed", error: loaded.error });
      }
    }
    // Spec 166: a group with upgrade "on-demand" keeps its copies; whoever needs a full file asks for it with request().
    if (low && outcome.status === "ready" && group.upgrade !== "on-demand") {
      const upgrades = this.#imageIds(ids).filter((id) => this.#assets.lowPathOf(id));
      // The first layer's full files wait for the first frame; a later layer's follow their copies at once (spec 159).
      if (priority === "blocking") this.#upgrades.push(...upgrades);
      else await this.#loadIds(upgrades, priority);
    }
    times.settledMs = this.#now?.() ?? null;
    this.#settleGroup(group, outcome);
    return outcome;
  }

  #imageIds(ids) {
    return ids.filter((id) => this.#assets.entryOf(id).kind === "image");
  }
}
