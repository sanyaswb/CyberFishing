// AquariumFishView keeps its production drawing path. A preview flushes one queued
// frame explicitly; a recursively requested frame never creates an animation loop.
export class UiCatalogFrameScheduler {
  #frames = new Map();
  #nextId = 0;
  #time = 0;
  #disposed = false;
  constructor({ windowTarget }) {
    this.devicePixelRatio = windowTarget.devicePixelRatio || 1;
  }
  requestAnimationFrame = (callback) => {
    if (this.#disposed) return null;
    const id = ++this.#nextId;
    this.#frames.set(id, callback);
    return id;
  };
  cancelAnimationFrame = (id) => { this.#frames.delete(id); };
  flush(deltaMs = 0) {
    if (this.#disposed) return;
    this.#time += Math.max(0, Number(deltaMs) || 0);
    const queued = [...this.#frames.values()];
    this.#frames.clear();
    for (const callback of queued) callback(this.#time);
  }
  dispose() { this.#disposed = true; this.#frames.clear(); }
}
