// Spec 165 A1: what choosing a bait (or a chum) does with the equipped tackle's header cells. One plan serves the click on
// the card (InventoryCommandService) and the editor's action button (InventoryViewModelFactory), so both always agree:
// - "unavailable": no cell accepts it (no rod, no tackle, no fitting hook);
// - "on-hook": nothing to replace, the chosen cell (or every cell) already holds this bait (TK-241);
// - "fill": the target cell takes it now (an empty cell, or the cell offered for replacement and confirmed);
// - "offer": every cell holds another bait: the target cell is proposed for replacement.
export class ConsumablePlacementPlanner {
  #consumableTargets;
  #attachmentTargetResolver;
  #repository;
  #hydrator;

  constructor({ consumableTargets, attachmentTargetResolver, repository, hydrator } = {}) {
    if (!consumableTargets?.list || !attachmentTargetResolver?.accepts || !repository?.get || !hydrator?.hydrate) {
      throw new TypeError("ConsumablePlacementPlanner requires consumable targets, an attachment resolver, a repository and a hydrator");
    }
    this.#consumableTargets = consumableTargets;
    this.#attachmentTargetResolver = attachmentTargetResolver;
    this.#repository = repository;
    this.#hydrator = hydrator;
  }

  // pick: the inventory UI state's consumable pick ({ consumableKind, pickedSocketId, selectedInstanceId });
  // liveBaitOnHook: a chosen live bait holds the single hook (TK-246): its cell counts as taken by another bait.
  plan(source, kind, { consumableKind = null, pickedSocketId = null, selectedInstanceId = null } = {}, { liveBaitOnHook = false } = {}) {
    const all = this.#consumableTargets.list(kind);
    const own = all.find((target) => target.occupied?.instanceId === source.instanceId);
    if (own) return { action: "on-hook", target: own };
    const targets = all.filter((target) => this.#attachmentTargetResolver.accepts(target, source));
    if (!targets.length) return { action: "unavailable", target: null };
    const explicit = consumableKind === kind ? targets.find((target) => target.socketId === pickedSocketId) : null;
    const liveTaken = kind === "bait" && liveBaitOnHook && all.length === 1;
    const empty = liveTaken ? null : targets.find((target) => !target.occupied);
    // TK-241: the same baitId is the same bait (a jar of 25 or 50 oil worms), so there is nothing to replace.
    const sourceKind = this.#kindOf(source);
    const same = (target) => Boolean(target.occupied) && this.#kindOf(target.occupied) === sourceKind;
    if (explicit ? same(explicit) : !empty && targets.every(same)) {
      return { action: "on-hook", target: explicit || targets.find(same) };
    }
    if (explicit && (!selectedInstanceId || selectedInstanceId === source.instanceId)) return { action: "fill", target: explicit };
    if (empty) return { action: "fill", target: empty };
    // Prefer a different bait: selecting a worm beside worm + bread proposes replacing only the bread.
    return { action: "offer", target: targets.find((target) => target.occupied && target.occupied.itemId !== source.itemId) ||
      targets[0] };
  }

  // A consumable's kind for replacement: its catalog bait id, or its item id.
  #kindOf(rawItem) {
    return this.#hydrator.hydrate(rawItem, this.#repository)?.baitId || rawItem.itemId;
  }
}
