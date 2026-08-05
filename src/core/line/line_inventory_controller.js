class LineInventoryController {
  #inventory;
  #db;
  #makeId;
  #policy;
  #isEquipped;

  constructor({ inventory, db, makeId, lineConfig, isEquipped }) {
    this.#inventory = inventory;
    this.#db = db;
    this.#makeId = makeId;
    this.#policy = new LineAllocationPolicy(lineConfig || {});
    this.#isEquipped = isEquipped || (() => false);
  }

  validateLine(lineItem, equipment) {
    return this.#policy.resolve({ lineItem, equipment });
  }

  validateLeader(_leaderItem, equipment) {
    if (!equipment?.line) {
      return {
        isValid: false,
        reason: "Поводок можна спорядити тільки після ліски.",
      };
    }
    return { isValid: true };
  }

  rodRequiresReel(rod) {
    return this.#policy.rodRequiresReel(rod);
  }

  getMinimumLineLengthMeters(rod) {
    return this.#policy.getMinimumLineLengthMeters(rod);
  }

  getMaximumLineLengthMeters(rod, reel = null) {
    return this.#policy.getMaximumLineLengthMeters({ rod, reel });
  }

  prepareLineForEquip({ slotPath, instanceId, itemData, equipment }) {
    const baseSlot = (slotPath || "").split("_")[0];
    if (baseSlot !== "line" || itemData?.type !== "fishing_line") {
      return instanceId;
    }

    const sourceItem = this.#inventory.getInstance(instanceId);
    const allocation = this.validateLine(itemData, equipment);
    if (!allocation.isValid || !allocation.shouldSplit) return instanceId;
    if (!sourceItem) return instanceId;

    return this.#allocateSegment({ sourceItem, allocation });
  }

  mergeDetachedLineSegment(lineItem) {
    if (!lineItem?.instanceId) return false;
    const sourceItem = this.#inventory.getInstance(lineItem.instanceId);
    if (!sourceItem?.detachedLineSegment) return false;

    const sourceInstance = sourceItem.sourceLineInstanceId
      ? this.#inventory.getInstance(sourceItem.sourceLineInstanceId)
      : null;
    if (
      sourceInstance &&
      !sourceInstance.detachedLineSegment &&
      this.#canMergeLineItems(sourceItem, sourceInstance)
    ) {
      this.#setLineLengthMeters(
        sourceInstance,
        this.getInventoryLineLengthMeters(sourceInstance) +
          this.getInventoryLineLengthMeters(sourceItem),
      );
      this.#inventory.remove(sourceItem.instanceId);
      return true;
    }

    return this.mergeLineLengthIntoAvailableStack(sourceItem);
  }

  mergeLineLengthIntoAvailableStack(sourceItem) {
    if (!sourceItem) return false;
    const sourceData = this.#hydrateLineItem(sourceItem);
    if (sourceData?.type !== "fishing_line") return false;

    const targetItem = this.#findLineLengthMergeTarget(sourceItem, sourceData);
    if (!targetItem) {
      sourceItem.quantity = 1;
      delete sourceItem.detachedLineSegment;
      delete sourceItem.sourceLineItemId;
      delete sourceItem.sourceLineInstanceId;
      return false;
    }

    this.#setLineLengthMeters(
      targetItem,
      this.getInventoryLineLengthMeters(targetItem) +
        this.getInventoryLineLengthMeters(sourceItem),
    );
    this.#inventory.remove(sourceItem.instanceId);
    return true;
  }

  getInventoryLineLengthMeters(item) {
    if (!item) return 0;
    const ownLength = Number(item.lengthMeters);
    if (Number.isFinite(ownLength)) return Math.max(0, ownLength);
    const base = this.#db.getItemData(item.itemId);
    const baseLength = Number(base?.lengthMeters ?? base?.engineStats?.lengthMeters);
    return Number.isFinite(baseLength) ? Math.max(0, baseLength) : 0;
  }

  #allocateSegment({ sourceItem, allocation }) {
    const equipLength = Math.max(0, Number(allocation.equipLengthMeters) || 0);
    const remainingLength = Math.max(0, Number(allocation.remainingLengthMeters) || 0);
    if (equipLength <= 0) return sourceItem.instanceId;

    this.#setLineLengthMeters(sourceItem, remainingLength);

    const segmentId = this.#makeId("uuid_line_segment");
    const segmentItem = {
      ...sourceItem,
      instanceId: segmentId,
      quantity: 1,
      lengthMeters: equipLength,
      detachedLineSegment: true,
      sourceLineItemId: sourceItem.itemId,
      sourceLineInstanceId: sourceItem.instanceId,
    };

    this.#inventory.addItem(segmentItem);
    return segmentId;
  }

  #setLineLengthMeters(item, lengthMeters) {
    if (!item) return;
    item.lengthMeters = Math.max(0, Number(lengthMeters) || 0);
    item.quantity = 1;
  }

  #findLineLengthMergeTarget(sourceItem, sourceData) {
    const items = this.#inventory.getAll();
    for (let i = 0; i < items.length; i++) {
      const candidate = items[i];
      if (candidate === sourceItem) continue;
      if (candidate.detachedLineSegment) continue;
      if (!this.#hasSameBuildContext(sourceItem, candidate)) continue;
      if (this.#isEquipped(candidate.instanceId)) continue;
      if (candidate.itemId !== sourceItem.itemId) continue;

      const candidateData = this.#hydrateLineItem(candidate);
      if (!this.#hasSameLineMergeSignature(sourceData, candidateData)) continue;
      return candidate;
    }
    return null;
  }

  #canMergeLineItems(a, b) {
    if (!a || !b) return false;
    if (a.itemId !== b.itemId) return false;
    if (!this.#hasSameBuildContext(a, b)) return false;
    const sourceData = this.#hydrateLineItem(a);
    const targetData = this.#hydrateLineItem(b);
    return this.#hasSameLineMergeSignature(sourceData, targetData);
  }

  #hasSameBuildContext(a, b) {
    return (a?.buildId ?? null) === (b?.buildId ?? null);
  }

  #hydrateLineItem(item) {
    if (!item) return null;
    const base = this.#db.getItemData(item.itemId);
    if (!base) return null;
    return { ...base, ...(base.engineStats || {}), ...item };
  }

  #hasSameLineMergeSignature(a, b) {
    if (!a || !b) return false;
    const keys = ["id", "type", "maxLoadKg", "diameterMm", "durability"];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const av = a[key] ?? a.engineStats?.[key];
      const bv = b[key] ?? b.engineStats?.[key];
      if (String(av) !== String(bv)) return false;
    }
    return JSON.stringify(a.rarity) === JSON.stringify(b.rarity);
  }
}
