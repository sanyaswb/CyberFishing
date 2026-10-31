import { AssetLoadQueue } from "../../engine/assets/asset_load_queue.js";

// Runs the asset load plan (spec 157 R15, stages D1-D2): every image the plan loads goes into the game's one
// ImageAssetProvider under its asset id, so the renderers, the scene and the views find it by that id. A layer runs its
// groups by priority (the same priority in parallel, the next one when they have settled); a layer that starts
// "after:<layer>" follows that layer on its own. Loads never reject: a group settles { status, ids, error }.
// Every load goes through one AssetLoadQueue: the first layer is "blocking", the second "upgrade", later layers
// "prefetch" (background work, capped and paused while the conditions say so: hidden tab, offline, save-data), and
// request() — what the player opened — is "interactive": it overtakes the background and promotes a queued job.
// Only images load here; audio, Spine exports and other kinds stay with their own loaders on use.
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

  // plan: AssetLoadPlan; assets: AssetRegistry; imageAssets: the game's ImageAssetProvider; scheduler: { setTimeout,
  // clearTimeout } (retries); conditions: { isPaused(), subscribe(listener) } or null (never paused).
  // networkSlots: the start's first layer (16 images today) must not queue behind a small cap over HTTP/2 (measured:
  // 6 slots cost 0.1 s and a request wave on Fast 4G); backgroundSlots caps the later layers.
  constructor({ plan, assets, imageAssets, scheduler, conditions = null, networkSlots = 24, backgroundSlots = 4,
    maxAttempts = 2 }) {
    if (typeof plan?.resolveGroup !== "function") throw new TypeError("GameAssetPreloadFacade requires a plan");
    if (typeof assets?.pathOf !== "function") throw new TypeError("GameAssetPreloadFacade requires assets");
    if (typeof imageAssets?.preload !== "function") throw new TypeError("GameAssetPreloadFacade requires imageAssets");
    this.#plan = plan;
    this.#assets = assets;
    this.#images = imageAssets;
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
    const index = this.#plan.layers.findIndex((layer) => layer.id === layerId);
    const run = this.#runLayer(this.#plan.layer(layerId), LAYER_PRIORITIES[index] ?? "prefetch");
    this.#layerRuns.set(layerId, run);
    run.then(() => {
      for (const layer of this.#plan.layers) if (layer.start === `after:${layerId}`) this.start(layer.id);
    });
    return run;
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
      groups: layer.groups.map((group) => ({ id: group.id, label: group.label, priority: group.priority, load: group.load,
        status: this.#groupOutcomes.get(group.id)?.status ?? "waiting", ids: this.#groupOutcomes.get(group.id)?.ids ?? [] })),
    }));
  }

  async #runLayer(layer, priority) {
    const priorities = [...new Set(layer.groups.map((group) => group.priority))];
    for (const groupPriority of priorities) {
      await Promise.all(layer.groups.filter((group) => group.priority === groupPriority)
        .map((group) => this.#loadGroup(group, priority)));
    }
  }

  async #loadIds(ids, priority) {
    const results = await Promise.all(this.#imageIds(ids).map((id) => this.#queue.request({ key: id, priority,
      load: () => this.#images.preload([{ id, src: this.#assets.pathOf(id) }]) }).result));
    const failed = results.find((result) => result.status !== "ready");
    return { status: failed ? "failed" : "ready", ids, error: failed ? failed.error ?? new Error(failed.status) : null };
  }

  async #loadGroup(group, priority) {
    const ids = this.#plan.resolveGroup(group, this.#state);
    const outcome = group.load ? await this.#loadIds(ids, priority) : { status: "on-demand", ids, error: null };
    this.#groupOutcomes.set(group.id, outcome);
    this.#groupWaiters.get(group.id)?.resolve(outcome);
    return outcome;
  }

  #imageIds(ids) {
    return ids.filter((id) => this.#assets.entryOf(id).kind === "image");
  }
}
