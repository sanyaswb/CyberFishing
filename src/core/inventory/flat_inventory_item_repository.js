class FlatInventoryItemRepository {
  #items = new Map();
  #childrenByParent = new Map();
  #instanceIdFactory;
  #reservationPolicy;
  #fallbackSequence = 0;

  constructor({
    items = [],
    instanceIdFactory = null,
    reservationPolicy = null,
  } = {}) {
    this.#instanceIdFactory = instanceIdFactory;
    this.#reservationPolicy = reservationPolicy;
    for (const item of items || []) {
      const normalized = this.#normalizeItem(item);
      if (this.#items.has(normalized.instanceId)) {
        throw new RangeError(`Duplicate instanceId: ${normalized.instanceId}`);
      }
      this.#items.set(normalized.instanceId, normalized);
    }
    this.#rebuildIndexesAndValidate();
  }

  get size() {
    return this.#items.size;
  }

  has(instanceId) {
    return this.#items.has(instanceId);
  }

  get(instanceId) {
    return this.#items.get(instanceId) || null;
  }

  require(instanceId) {
    const item = this.get(instanceId);
    if (!item) throw new RangeError(`Unknown item instance: ${instanceId}`);
    return item;
  }

  list() {
    return [...this.#items.values()];
  }

  find(predicate) {
    return this.list().filter(predicate);
  }

  add(item) {
    const normalized = this.#normalizeItem(item);
    if (this.#items.has(normalized.instanceId)) {
      throw new RangeError(`Duplicate instanceId: ${normalized.instanceId}`);
    }
    this.#items.set(normalized.instanceId, normalized);
    try {
      this.#rebuildIndexesAndValidate();
    } catch (error) {
      this.#items.delete(normalized.instanceId);
      this.#rebuildIndexesAndValidate();
      throw error;
    }
    return normalized;
  }

  remove(instanceId) {
    const item = this.require(instanceId);
    if (this.getChildren(instanceId).length > 0) {
      throw new Error(`Cannot remove item with attached children: ${instanceId}`);
    }
    this.#items.delete(instanceId);
    this.#rebuildIndexesAndValidate();
    return item;
  }

  update(instanceId, updater) {
    const previous = this.require(instanceId);
    const candidate =
      typeof updater === "function"
        ? updater(previous)
        : { ...previous, ...(updater || {}) };
    if (!candidate || candidate.instanceId !== instanceId) {
      throw new Error("An inventory update cannot change instanceId");
    }

    const normalized = this.#normalizeItem(candidate);
    this.#items.set(instanceId, normalized);
    try {
      this.#rebuildIndexesAndValidate();
    } catch (error) {
      this.#items.set(instanceId, previous);
      this.#rebuildIndexesAndValidate();
      throw error;
    }
    return normalized;
  }

  setLocation(instanceId, location) {
    return this.update(instanceId, (item) => ({
      ...item,
      location: InventoryItemLocation.normalize(location),
    }));
  }

  splitOne(instanceId) {
    const source = this.require(instanceId);
    if (!InventoryItemLocation.isInventory(source.location)) {
      throw new Error(`Only an inventory stack can be split: ${instanceId}`);
    }
    if (source.quantity === 1) return source;

    const splitInstanceId = this.#nextInstanceId(source);
    const splitItem = {
      ...this.#clone(source),
      instanceId: splitInstanceId,
      quantity: 1,
      location: InventoryItemLocation.inventory(),
    };
    this.update(instanceId, { quantity: source.quantity - 1 });
    try {
      return this.add(splitItem);
    } catch (error) {
      this.update(instanceId, { quantity: source.quantity });
      throw error;
    }
  }

  getChild(parentInstanceId, slotId, slotIndex = 0) {
    return (
      this.getChildren(parentInstanceId, slotId).find(
        (item) => item.location.slotIndex === slotIndex,
      ) || null
    );
  }

  getChildren(parentInstanceId, slotId = null) {
    const children = this.#childrenByParent.get(parentInstanceId) || [];
    return children
      .filter((item) => slotId == null || item.location.slotId === slotId)
      .sort((left, right) => {
        const slotOrder = left.location.slotId.localeCompare(right.location.slotId);
        return slotOrder || left.location.slotIndex - right.location.slotIndex;
      });
  }

  listDescendants(instanceId) {
    this.require(instanceId);
    const descendants = [];
    const visit = (parentInstanceId, depth) => {
      for (const child of this.getChildren(parentInstanceId)) {
        descendants.push({ item: child, depth });
        visit(child.instanceId, depth + 1);
      }
    };
    visit(instanceId, 1);
    return descendants;
  }

  mergeInventoryItem(instanceId, stackingPolicy, { canMerge = null } = {}) {
    const source = this.require(instanceId);
    if (!InventoryItemLocation.isInventory(source.location)) {
      throw new Error(`Only inventory items can merge: ${instanceId}`);
    }
    if (this.getChildren(instanceId).length > 0) return instanceId;
    if (!this.#canMergeItem(source, canMerge)) return instanceId;
    if (!stackingPolicy || typeof stackingPolicy.canStack !== "function") {
      return instanceId;
    }

    const target = this.list().find((candidate) => {
      if (candidate.instanceId === instanceId) return false;
      if (!InventoryItemLocation.isInventory(candidate.location)) return false;
      if (this.getChildren(candidate.instanceId).length > 0) return false;
      if (!this.#canMergeItem(candidate, canMerge)) return false;
      return stackingPolicy.canStack(candidate, source);
    });
    if (!target) return instanceId;

    this.update(target.instanceId, {
      quantity: target.quantity + source.quantity,
    });
    this.remove(instanceId);
    return target.instanceId;
  }

  toSnapshot() {
    return this.list().map((item) => this.#clone(item));
  }

  createSnapshot() {
    return this.toSnapshot();
  }

  restoreSnapshot(snapshot) {
    const replacement = new Map();
    for (const item of snapshot || []) {
      const normalized = this.#normalizeItem(item);
      if (replacement.has(normalized.instanceId)) {
        throw new RangeError(`Duplicate instanceId: ${normalized.instanceId}`);
      }
      replacement.set(normalized.instanceId, normalized);
    }
    const previous = this.#items;
    this.#items = replacement;
    try {
      this.#rebuildIndexesAndValidate();
    } catch (error) {
      this.#items = previous;
      this.#rebuildIndexesAndValidate();
      throw error;
    }
  }

  #normalizeItem(item) {
    if (!item || typeof item !== "object") {
      throw new TypeError("Inventory item must be an object");
    }
    if (typeof item.instanceId !== "string" || item.instanceId.length === 0) {
      throw new TypeError("Inventory item requires instanceId");
    }
    if (typeof item.itemId !== "string" || item.itemId.length === 0) {
      throw new TypeError("Inventory item requires itemId");
    }
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new RangeError("Inventory item quantity must be a positive integer");
    }
    const location = InventoryItemLocation.normalize(item.location);
    if (!InventoryItemLocation.isInventory(location) && quantity !== 1) {
      throw new Error("Attached and loadout items must have quantity 1");
    }
    const normalized = {
      ...this.#clone(item),
      quantity,
      location,
    };
    if (
      quantity !== 1 &&
      this.#reservationPolicy?.isReserved?.(normalized)
    ) {
      throw new Error(
        `Reserved inventory root ${item.instanceId} must have quantity 1`,
      );
    }
    return Object.freeze(normalized);
  }

  #canMergeItem(item, operationPredicate) {
    if (this.#reservationPolicy?.canMerge?.(item) === false) return false;
    return (
      typeof operationPredicate !== "function" || operationPredicate(item)
    );
  }

  #rebuildIndexesAndValidate() {
    this.#childrenByParent = new Map();
    const occupiedAttachmentSlots = new Set();
    const occupiedLoadoutSlots = new Set();

    for (const item of this.#items.values()) {
      const location = item.location;
      if (InventoryItemLocation.isAttached(location)) {
        if (!this.#items.has(location.parentInstanceId)) {
          throw new Error(
            `Attached item ${item.instanceId} has an unknown parent ${location.parentInstanceId}`,
          );
        }
        if (location.parentInstanceId === item.instanceId) {
          throw new Error(`Item cannot be attached to itself: ${item.instanceId}`);
        }
        const slotKey = [
          location.parentInstanceId,
          location.slotId,
          location.slotIndex,
        ].join("::");
        if (occupiedAttachmentSlots.has(slotKey)) {
          throw new Error(`Attachment slot is already occupied: ${slotKey}`);
        }
        occupiedAttachmentSlots.add(slotKey);
        const siblings = this.#childrenByParent.get(location.parentInstanceId) || [];
        siblings.push(item);
        this.#childrenByParent.set(location.parentInstanceId, siblings);
      }

      if (InventoryItemLocation.isLoadout(location)) {
        const slotKey = `${location.loadoutId}::${location.slotId}`;
        if (occupiedLoadoutSlots.has(slotKey)) {
          throw new Error(`Loadout slot is already occupied: ${slotKey}`);
        }
        occupiedLoadoutSlots.add(slotKey);
      }
    }

    for (const item of this.#items.values()) {
      this.#assertNoLocationCycle(item.instanceId);
    }
  }

  #assertNoLocationCycle(instanceId) {
    const visited = new Set([instanceId]);
    let cursor = this.get(instanceId);
    while (InventoryItemLocation.isAttached(cursor?.location)) {
      const parentId = cursor.location.parentInstanceId;
      if (visited.has(parentId)) {
        throw new Error(`Attachment cycle detected at ${parentId}`);
      }
      visited.add(parentId);
      cursor = this.get(parentId);
    }
  }

  #nextInstanceId(source) {
    let candidate = null;
    do {
      if (typeof this.#instanceIdFactory === "function") {
        candidate = this.#instanceIdFactory(source);
      } else if (this.#instanceIdFactory?.create) {
        candidate = this.#instanceIdFactory.create(source);
      } else {
        this.#fallbackSequence++;
        candidate = `${source.instanceId}~${Date.now().toString(36)}-${this.#fallbackSequence}`;
      }
    } while (!candidate || this.#items.has(candidate));
    return String(candidate);
  }

  #clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }
}
