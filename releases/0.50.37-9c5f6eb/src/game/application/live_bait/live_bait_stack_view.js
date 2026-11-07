import { LiveBaitStackId } from "../../domain/live_bait/live_bait_stack_id.js";

// Spec 163 stage 2: the backpack's live bait stacks for the inventory (cards and the stack panel) with the fish art's
// asset ids, and «В садок». The stacks are a view of the keepnet and aquarium live baits (LiveBaitCommandService).
export class LiveBaitStackView {
  #liveBait;
  #iconAssetOf;

  // liveBait: LiveBaitCommandService; iconAssetOf(imagePath): the fish image's asset id.
  constructor({ liveBait, iconAssetOf }) {
    for (const method of ["getInventoryStacks", "hideSpeciesFromInventory"]) {
      if (typeof liveBait?.[method] !== "function") throw new TypeError(`LiveBaitStackView requires liveBait.${method}`);
    }
    if (typeof iconAssetOf !== "function") throw new TypeError("LiveBaitStackView requires iconAssetOf");
    this.#liveBait = liveBait;
    this.#iconAssetOf = iconAssetOf;
  }

  // [{ id (card id), speciesId, name, iconAsset, count, fish: [{ id, name, iconAsset, lifeShare, location }] }]
  stacks() {
    return this.#liveBait.getInventoryStacks().map((stack) => ({
      id: LiveBaitStackId.of(stack.speciesId), speciesId: stack.speciesId, name: stack.name,
      iconAsset: this.#iconAssetOf(stack.imagePath), count: stack.count,
      fish: stack.fish.map((fish) => ({ id: fish.id, name: fish.name, iconAsset: this.#iconAssetOf(fish.imagePath),
        lifeShare: fish.lifeShare, location: fish.location })),
    }));
  }

  // «В садок»: the backpack stops showing the species; its fish stay in the keepnet.
  hide(speciesId) { return this.#liveBait.hideSpeciesFromInventory(speciesId); }
}
