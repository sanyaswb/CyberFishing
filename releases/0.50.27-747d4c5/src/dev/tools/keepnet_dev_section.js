// DevTools «🐟 САДОК» (TK-227): the keepnet's fill and buttons that bring it to 0 / 20 / 40 / 60 / 80 / 100 % of its
// capacity with random fish (a random species of the game, level, weight within the level's range, the level's art and a
// random rarity). A species without levelWeightRanges splits its depth weight range into maxLevel equal levels, like the
// bite system's level weight (TK-228). Fish go in and out through the ordinary keep and release commands, so the save stays valid; a fish on the
// hook (reserved) is never released. DEV only: production composes the port, never this section.
export const KEEPNET_FILL_TARGETS = Object.freeze([0, 20, 40, 60, 80, 100]);
const RARITY = Object.freeze({ maxHalfSteps: 10, unitsPerStar: 2 });

export class KeepnetDevSection {
  #ui;
  #keepnet;
  #species;
  #createSection;
  #random;
  #content = null;

  // keepnet: { getView(), keepCatch(fish), releaseCatch(id), releaseBait(id), species: FISH_DB, imagePathOf(fish) };
  // createSection(label, parent, path) comes from DevTools; random() returns [0, 1).
  constructor({ ui, keepnet, createSection, random = Math.random }) {
    this.#ui = ui;
    this.#keepnet = keepnet;
    this.#species = keepnet.species.map((species) => ({ species, ranges: KeepnetDevSection.#levelRanges(species) }))
      .filter((entry) => entry.ranges.length > 0);
    this.#createSection = createSection;
    this.#random = random;
  }

  render(parent) {
    this.#content = this.#createSection("🐟 САДОК", parent, ["KEEPNET"]);
    this.#render();
  }

  // Brings the occupied places (catches, live baits in the keepnet, a fish on the hook) to percent of the capacity.
  fill(percent) {
    const view = this.#keepnet.getView();
    const target = Math.round(view.keepnetCapacity * Math.min(100, Math.max(0, percent)) / 100);
    const live = view.liveBaits.filter((fish) => fish.location === "keepnet");
    let occupied = view.keepnet.length + live.length + (view.keepnetReservedCount || 0);
    let added = 0, released = 0;
    const removable = [...view.keepnet.map((fish) => () => this.#keepnet.releaseCatch(fish.id)),
      ...live.map((fish) => () => this.#keepnet.releaseBait(fish.id))];
    while (occupied > target && removable.length > 0) {
      if (!removable.pop()().ok) break;
      occupied--; released++;
    }
    while (occupied < target && this.#species.length > 0) {
      if (!this.#keepnet.keepCatch(this.#randomFish()).ok) break;
      occupied++; added++;
    }
    return { added, released, occupied, capacity: view.keepnetCapacity };
  }

  #render() {
    const content = this.#content;
    if (!content) return;
    content.replaceChildren();
    const view = this.#keepnet.getView();
    const live = view.liveBaits.filter((fish) => fish.location === "keepnet").length;
    const occupied = view.keepnet.length + live + (view.keepnetReservedCount || 0);
    const percent = view.keepnetCapacity > 0 ? Math.round(occupied / view.keepnetCapacity * 100) : 0;
    this.#ui.createInfoRow("заповнено", `${occupied} / ${view.keepnetCapacity} (${percent}%)`, content);
    this.#ui.createInfoRow("улов · живці · на гачку", `${view.keepnet.length} · ${live} · ${view.keepnetReservedCount || 0}`, content);
    this.#ui.createButtonRow("↻ Оновити", content, () => this.#render());
    for (const target of KEEPNET_FILL_TARGETS) {
      this.#ui.createButtonRow(`Заповнити на ${target}%`, content, () => {
        this.fill(target);
        this.#render();
      });
    }
  }

  // Weight ranges per level: the authored ones, or maxLevel equal parts of the depth weight range.
  static #levelRanges(species) {
    const authored = species.weightConfig?.levelWeightRanges;
    if (Array.isArray(authored) && authored.length > 0) return authored;
    const low = Number(species.depthConfig?.minWeightAtMinDepth), high = Number(species.depthConfig?.maxWeightAtMaxDepth);
    const levels = Math.max(1, Math.round(Number(species.weightConfig?.maxLevel) || 1));
    if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return [];
    const step = (high - low) / levels;
    return Array.from({ length: levels }, (_, index) => ({ level: index + 1, min: low + step * index, max: low + step * (index + 1) }));
  }

  #randomFish() {
    const { species, ranges } = this.#species[Math.floor(this.#random() * this.#species.length)];
    const range = ranges[Math.floor(this.#random() * ranges.length)];
    const weight = Math.round((range.min + this.#random() * (range.max - range.min)) * 1000) / 1000;
    const fish = { id: species.id, name: species.name, level: range.level, weight: Math.max(0.001, weight) };
    return { ...fish, imagePath: this.#keepnet.imagePathOf(fish),
      rarity: { halfSteps: 1 + Math.floor(this.#random() * RARITY.maxHalfSteps), ...RARITY } };
  }
}
