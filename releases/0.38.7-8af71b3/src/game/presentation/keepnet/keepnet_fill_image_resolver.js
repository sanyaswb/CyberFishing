// The existing occupancy reading owns capacity; this resolver only chooses presentation artwork.
export class KeepnetFillImageResolver {
  #stages;

  constructor({ stages }) {
    this.#stages = stages;
  }

  resolve(percent) {
    const value = Number(percent);
    const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    for (const stage of this.#stages) {
      if (normalized <= stage.maxPercent) return stage.imagePath;
    }
    return this.#stages[this.#stages.length - 1].imagePath;
  }
}
