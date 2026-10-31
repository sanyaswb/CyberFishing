// Runs the asset load plan (spec 157 R15, stage D1): every image the plan loads goes into the game's one
// ImageAssetProvider under its asset id, so the renderers, the scene and the views find it by that id. A layer runs its
// groups by priority (the same priority in parallel, the next one when they have settled); a layer that starts
// "after:<layer>" follows that layer on its own. Loads never reject: a group settles { status, ids, error }.
// Only images load here; audio, Spine exports and other kinds stay with their own loaders on use.
export class GameAssetPreloadFacade {
  #plan;
  #assets;
  #images;
  #state = {};
  #layerRuns = new Map();
  #groupOutcomes = new Map();
  #groupWaiters = new Map();

  // plan: AssetLoadPlan; assets: AssetRegistry; imageAssets: the game's ImageAssetProvider.
  constructor({ plan, assets, imageAssets }) {
    if (typeof plan?.resolveGroup !== "function") throw new TypeError("GameAssetPreloadFacade requires a plan");
    if (typeof assets?.pathOf !== "function") throw new TypeError("GameAssetPreloadFacade requires assets");
    if (typeof imageAssets?.preload !== "function") throw new TypeError("GameAssetPreloadFacade requires imageAssets");
    this.#plan = plan;
    this.#assets = assets;
    this.#images = imageAssets;
  }

  // Starts a layer once; state (the startup state for the plan's sources) is merged into what earlier layers gave.
  start(layerId, state = {}) {
    if (this.#layerRuns.has(layerId)) return this.#layerRuns.get(layerId);
    Object.assign(this.#state, state);
    const run = this.#runLayer(this.#plan.layer(layerId));
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

  // Images by asset id outside the plan's order (an open view needs them now).
  request(ids) {
    return Promise.all(this.#imageIds(ids).map((id) => this.#images.preload([{ id, src: this.#assets.pathOf(id) }])));
  }

  // For the DEV overlay: every layer and group with its state and ids.
  getStatus() {
    return this.#plan.layers.map((layer) => ({
      id: layer.id, label: layer.label, started: this.#layerRuns.has(layer.id),
      groups: layer.groups.map((group) => ({ id: group.id, label: group.label, priority: group.priority, load: group.load,
        status: this.#groupOutcomes.get(group.id)?.status ?? "waiting", ids: this.#groupOutcomes.get(group.id)?.ids ?? [] })),
    }));
  }

  async #runLayer(layer) {
    const priorities = [...new Set(layer.groups.map((group) => group.priority))];
    for (const priority of priorities) {
      await Promise.all(layer.groups.filter((group) => group.priority === priority).map((group) => this.#loadGroup(group)));
    }
  }

  async #loadGroup(group) {
    const ids = this.#plan.resolveGroup(group, this.#state);
    let outcome;
    if (!group.load) outcome = { status: "on-demand", ids, error: null };
    else {
      const results = await Promise.all(this.#imageIds(ids).map((id) => this.#images
        .preload([{ id, src: this.#assets.pathOf(id) }]).then(() => null, (error) => error)));
      const error = results.find(Boolean) ?? null;
      outcome = { status: error ? "failed" : "ready", ids, error };
    }
    this.#groupOutcomes.set(group.id, outcome);
    this.#groupWaiters.get(group.id)?.resolve(outcome);
    return outcome;
  }

  #imageIds(ids) {
    return ids.filter((id) => this.#assets.entryOf(id).kind === "image");
  }
}
