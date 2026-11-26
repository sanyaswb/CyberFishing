// Spec 162 stage 2: the chosen live bait on the tackle's hook. The game uses a live bait only on one hook without a
// regular bait (LiveBaitBaitCandidatePort), so «На живця» on an empty single hook chooses the live bait at once; over a
// regular bait the card and the hook's switcher cell turn green first ("pending"), and «Замінити» (or a tap on that cell)
// takes the bait off into the backpack and chooses the live bait. Nothing changes while the tackle is in the water.
// Views listen through onChange() and redraw.
export class LiveBaitHookController {
  #inventory;
  #liveBait;
  #iconAssetOf;
  #pendingFishId = null;
  #listeners = new Set();

  // inventory: { getEquipped(), isLocked (tackle in the water), removeHookBait(instanceId) -> { success } };
  // liveBait: LiveBaitCommandService; iconAssetOf(imagePath): the fish image's asset id.
  constructor({ inventory, liveBait, iconAssetOf }) {
    for (const method of ["getEquipped", "removeHookBait"]) {
      if (typeof inventory?.[method] !== "function") throw new TypeError(`LiveBaitHookController requires inventory.${method}`);
    }
    for (const method of ["selectBait", "getSelectedBait", "countSelectedReserve"]) {
      if (typeof liveBait?.[method] !== "function") throw new TypeError(`LiveBaitHookController requires liveBait.${method}`);
    }
    if (typeof iconAssetOf !== "function") throw new TypeError("LiveBaitHookController requires iconAssetOf");
    this.#inventory = inventory;
    this.#liveBait = liveBait;
    this.#iconAssetOf = iconAssetOf;
  }

  // The tackle's hooks: their count, the regular bait on them (or null) and whether the tackle is in the water.
  hookState() {
    const equipped = this.#inventory.getEquipped();
    return {
      hookCount: (equipped?.hooks || []).filter(Boolean).length,
      bait: (equipped?.baits || []).find(Boolean) || null,
      inWater: this.#inventory.isLocked === true,
    };
  }

  // The bait slot's picture: the chosen live bait while the single hook carries no regular bait, or null. reserve: live
  // baits of its species that can follow it onto the hook (TK-234), the switcher's count.
  preview() {
    const hook = this.hookState();
    if (hook.hookCount !== 1 || hook.bait) return null;
    const selected = this.#liveBait.getSelectedBait();
    if (!selected) return null;
    return { fishId: selected.fishId, name: selected.name, iconAsset: this.#iconAssetOf(selected.imagePath),
      reserve: this.#liveBait.countSelectedReserve() };
  }

  get pendingFishId() { return this.#pendingFishId; }

  // «На живця»: chooses the live bait on an empty single hook; over a regular bait it waits for «Замінити».
  // replaceLiveBait: the inventory's bait rules (spec 165 TK-245): another chosen live bait is a taken cell too, so the
  // new one waits for «Замінити» as well (the keepnet's «На живця» switches at once).
  choose(fishId, { replaceLiveBait = false } = {}) {
    const hook = this.hookState();
    if (hook.hookCount !== 1) return { ok: false, reason: "single_hook_required" };
    const chosen = replaceLiveBait && !hook.bait ? this.preview() : null;
    const otherLiveBait = chosen !== null && chosen.fishId !== fishId;
    if (hook.bait || otherLiveBait) {
      if (hook.inWater) return { ok: false, reason: "tackle_in_water" };
      this.#pendingFishId = fishId;
      this.#notify();
      return { ok: true, pending: true };
    }
    this.#pendingFishId = null;
    const result = this.#liveBait.selectBait(fishId);
    this.#notify();
    return result;
  }

  // «Замінити» or a tap on the green cell: the regular bait goes back to the backpack, the live bait is chosen.
  confirm() {
    const fishId = this.#pendingFishId;
    if (fishId === null) return { ok: false, reason: "nothing_pending" };
    const hook = this.hookState();
    if (hook.inWater) return { ok: false, reason: "tackle_in_water" };
    if (hook.bait && this.#inventory.removeHookBait(hook.bait.instanceId)?.success !== true) {
      return { ok: false, reason: "bait_not_removed" };
    }
    this.#pendingFishId = null;
    const result = this.#liveBait.selectBait(fishId);
    this.#notify();
    return result;
  }

  cancel() {
    if (this.#pendingFishId === null) return;
    this.#pendingFishId = null;
    this.#notify();
  }

  // The live bait comes off the switcher (a long press on its cell).
  clear() {
    this.#pendingFishId = null;
    const result = this.#liveBait.selectBait(null);
    this.#notify();
    return result;
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify() {
    for (const listener of [...this.#listeners]) listener();
  }
}
